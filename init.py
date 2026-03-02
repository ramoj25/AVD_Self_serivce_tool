"""
AVD Intelligent Pre-Warm — Pilot Function
==========================================
Runs every 5 minutes (fine-grained for pilot precision).

Flow:
  1. Load pilot_users.json
  2. For each enabled user, query Log Analytics for predicted login time today
  3. If NOW is within the user's buffer window → start their VM
  4. Tag the VM so we can track it
  5. Log everything to Application Insights

Environment variables required (set in Function App Settings):
  AZURE_SUBSCRIPTION_ID
  AVD_RESOURCE_GROUP
  LOG_ANALYTICS_WORKSPACE_ID
  AZURE_CLIENT_ID  (Managed Identity client ID)
"""

import logging
import os
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
import azure.functions as func
from azure.identity import ManagedIdentityCredential
from azure.mgmt.compute import ComputeManagementClient
from azure.monitor.query import LogsQueryClient, LogsQueryStatus

# ── Config ────────────────────────────────────────────────────────────────────
SUBSCRIPTION_ID       = os.environ["AZURE_SUBSCRIPTION_ID"]
AVD_RESOURCE_GROUP    = os.environ["AVD_RESOURCE_GROUP"]
LOG_ANALYTICS_WS_ID   = os.environ["LOG_ANALYTICS_WORKSPACE_ID"]

# Tag keys applied to VMs when pre-warm starts them
TAG_PREWARM_AT   = "avd-prewarm-started-at"
TAG_PREWARM_USER = "avd-prewarm-user"

# ── KQL: Get predicted login time for a specific user on a specific DOW ───────
PREDICTION_QUERY = """
WVDConnections
| where TimeGenerated >= ago(30d)
| summarize FirstActivity = min(TimeGenerated)
    by UserName, LoginDate = bin(TimeGenerated, 1d)
| where UserName =~ '{username}'
| extend LoginTimeDecimal = hourofday(FirstActivity) + (datetime_part('minute', FirstActivity) / 60.0)
| extend DayOfWeek = toint(dayofweek(FirstActivity) / 1d)
| where DayOfWeek == {dow}
| summarize
    PredictedLogin = avg(LoginTimeDecimal),
    StdDev         = stdev(LoginTimeDecimal),
    TrainCount     = count()
| where TrainCount >= 1
| project PredictedLogin, StdDev, TrainCount
"""

# ── KQL: Get VM name for a specific user (most recent session host) ───────────
VM_LOOKUP_QUERY = """
WVDConnections
| where TimeGenerated >= ago(30d)
| where UserName =~ '{username}'
| summarize LastSeen = max(TimeGenerated) by SessionHostName
| top 1 by LastSeen desc
| project SessionHostName
"""


def main(mytimer: func.TimerRequest) -> None:
    utc_now = datetime.now(timezone.utc)
    logging.info(f"[PreWarm-Pilot] ── Cycle start {utc_now.strftime('%Y-%m-%d %H:%M:%S')} UTC ──")

    # Skip weekends
    if utc_now.weekday() >= 5:
        logging.info("[PreWarm-Pilot] Weekend — skipping")
        return

    # ── Load pilot users ──────────────────────────────────────────────────────
    pilot_users = load_pilot_users()
    enabled_users = [u for u in pilot_users if u.get("enabled", False)]

    if not enabled_users:
        logging.warning("[PreWarm-Pilot] No enabled users in pilot_users.json")
        return

    logging.info(f"[PreWarm-Pilot] {len(enabled_users)} pilot user(s) loaded")

    # ── Init Azure clients ────────────────────────────────────────────────────
    credential     = ManagedIdentityCredential()
    logs_client    = LogsQueryClient(credential)
    compute_client = ComputeManagementClient(credential, SUBSCRIPTION_ID)

    # Current time as decimal e.g. 8.75 = 08:45
    now_decimal = utc_now.hour + (utc_now.minute / 60.0)

    # KQL day of week: Sun=0 Mon=1 ... Sat=6
    # Python weekday(): Mon=0 ... Sun=6 → convert
    dow_map = {0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 0}
    today_dow = dow_map[utc_now.weekday()]

    # ── Process each pilot user ───────────────────────────────────────────────
    for user in enabled_users:
        username       = user["userName"]
        buffer_minutes = user.get("bufferMinutes", 20)

        logging.info(f"[PreWarm-Pilot] Checking {username} (buffer: {buffer_minutes} min)")

        try:
            process_user(
                username       = username,
                buffer_minutes = buffer_minutes,
                now_decimal    = now_decimal,
                today_dow      = today_dow,
                utc_now        = utc_now,
                logs_client    = logs_client,
                compute_client = compute_client
            )
        except Exception as e:
            logging.error(f"[PreWarm-Pilot] Error processing {username}: {e}", exc_info=True)
            # Continue to next user — don't let one failure stop others


def process_user(
    username, buffer_minutes, now_decimal,
    today_dow, utc_now, logs_client, compute_client
):
    # ── Step 1: Get prediction ────────────────────────────────────────────────
    prediction = get_prediction(logs_client, username, today_dow)

    if prediction is None:
        logging.warning(f"[PreWarm-Pilot] No prediction available for {username} on DOW {today_dow}")
        return

    predicted_login = prediction["PredictedLogin"]
    std_dev         = prediction["StdDev"]
    train_count     = prediction["TrainCount"]

    # Pre-warm trigger time = predicted login minus buffer
    prewarm_trigger = predicted_login - (buffer_minutes / 60.0)

    # Check if NOW falls within this 5-minute function cycle window
    # i.e. prewarm_trigger is between now and now+5min
    cycle_window = 5 / 60.0
    in_window    = prewarm_trigger >= now_decimal and prewarm_trigger < (now_decimal + cycle_window)

    logging.info(
        f"[PreWarm-Pilot] {username} | "
        f"Predicted: {decimal_to_time(predicted_login)} | "
        f"PreWarm at: {decimal_to_time(prewarm_trigger)} | "
        f"Now: {decimal_to_time(now_decimal)} | "
        f"In window: {in_window} | "
        f"StdDev: {round(std_dev * 60, 1)} min | "
        f"TrainCount: {train_count}"
    )

    if not in_window:
        return

    # ── Step 2: Get VM name ───────────────────────────────────────────────────
    vm_name = get_vm_name(logs_client, username)

    if vm_name is None:
        logging.warning(f"[PreWarm-Pilot] No VM found for {username} — cannot pre-warm")
        return

    # ── Step 3: Check VM current state ───────────────────────────────────────
    vm_state = get_vm_state(compute_client, AVD_RESOURCE_GROUP, vm_name)

    if vm_state in ["running", "starting"]:
        logging.info(f"[PreWarm-Pilot] VM '{vm_name}' already {vm_state} — skipping")
        return

    if vm_state == "deallocating":
        logging.warning(f"[PreWarm-Pilot] VM '{vm_name}' is deallocating — will retry next cycle")
        return

    # ── Step 4: Start VM ──────────────────────────────────────────────────────
    logging.info(
        f"[PreWarm-Pilot] ▶ Starting VM '{vm_name}' for '{username}' | "
        f"Predicted login: {decimal_to_time(predicted_login)} | "
        f"VM state was: {vm_state}"
    )

    # Tag first so watchdog can track it
    tag_vm(compute_client, AVD_RESOURCE_GROUP, vm_name, username, utc_now)

    # Start the VM (async — non-blocking)
    compute_client.virtual_machines.begin_start(AVD_RESOURCE_GROUP, vm_name)

    logging.info(f"[PreWarm-Pilot] ✅ VM start initiated for '{vm_name}'")


def get_prediction(logs_client: LogsQueryClient, username: str, dow: int) -> dict | None:
    """Query Log Analytics for predicted login time for this user on this day of week."""
    query = PREDICTION_QUERY.format(username=username, dow=dow)

    try:
        result = logs_client.query_workspace(
            workspace_id = LOG_ANALYTICS_WS_ID,
            query        = query,
            timespan     = timedelta(days=30)
        )

        if result.status != LogsQueryStatus.SUCCESS or not result.tables:
            return None

        table = result.tables[0]
        if not table.rows:
            return None

        row = dict(zip(table.columns, table.rows[0]))

        # Validate we have a usable prediction
        if row.get("PredictedLogin") is None:
            return None

        return {
            "PredictedLogin": float(row["PredictedLogin"]),
            "StdDev":         float(row.get("StdDev") or 0),
            "TrainCount":     int(row.get("TrainCount") or 0)
        }

    except Exception as e:
        logging.error(f"[PreWarm-Pilot] Prediction query failed for {username}: {e}")
        return None


def get_vm_name(logs_client: LogsQueryClient, username: str) -> str | None:
    """Get the VM name for this user from their most recent WVD session."""
    query = VM_LOOKUP_QUERY.format(username=username)

    try:
        result = logs_client.query_workspace(
            workspace_id = LOG_ANALYTICS_WS_ID,
            query        = query,
            timespan     = timedelta(days=30)
        )

        if result.status != LogsQueryStatus.SUCCESS or not result.tables:
            return None

        table = result.tables[0]
        if not table.rows:
            return None

        row = dict(zip(table.columns, table.rows[0]))

        # SessionHostName is already vmname only — no parsing needed
        return row.get("SessionHostName")

    except Exception as e:
        logging.error(f"[PreWarm-Pilot] VM lookup failed for {username}: {e}")
        return None


def get_vm_state(compute_client: ComputeManagementClient, resource_group: str, vm_name: str) -> str:
    """Get current power state of a VM."""
    try:
        vm = compute_client.virtual_machines.get(
            resource_group, vm_name,
            expand="instanceView"
        )
        statuses = vm.instance_view.statuses if vm.instance_view else []

        for status in statuses:
            if status.code.startswith("PowerState/"):
                return status.code.replace("PowerState/", "").lower()

        return "unknown"

    except Exception as e:
        logging.error(f"[PreWarm-Pilot] Failed to get VM state for '{vm_name}': {e}")
        return "unknown"


def tag_vm(
    compute_client: ComputeManagementClient,
    resource_group: str,
    vm_name: str,
    username: str,
    utc_now: datetime
):
    """Tag VM with pre-warm metadata for tracking."""
    try:
        vm   = compute_client.virtual_machines.get(resource_group, vm_name)
        tags = vm.tags or {}
        tags[TAG_PREWARM_AT]   = utc_now.isoformat()
        tags[TAG_PREWARM_USER] = username

        compute_client.virtual_machines.begin_update(
            resource_group, vm_name,
            {"tags": tags}
        )
        logging.info(f"[PreWarm-Pilot] Tagged VM '{vm_name}' with pre-warm metadata")

    except Exception as e:
        # Non-fatal — tagging failure shouldn't stop VM start
        logging.warning(f"[PreWarm-Pilot] Could not tag VM '{vm_name}': {e}")


def load_pilot_users() -> list:
    """Load pilot users from JSON file next to this function."""
    config_path = Path(__file__).parent / "pilot_users.json"

    try:
        with open(config_path, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        logging.error(f"[PreWarm-Pilot] pilot_users.json not found at {config_path}")
        return []
    except json.JSONDecodeError as e:
        logging.error(f"[PreWarm-Pilot] pilot_users.json is invalid JSON: {e}")
        return []


def decimal_to_time(decimal_hours: float) -> str:
    """Convert decimal hours to HH:MM string e.g. 8.75 → 08:45"""
    if decimal_hours is None:
        return "N/A"
    hours   = int(decimal_hours)
    minutes = int((decimal_hours - hours) * 60)
    return f"{hours:02d}:{minutes:02d}"
