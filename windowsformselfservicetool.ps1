$ErrorActionPreference = "SilentlyContinue"

# =============================================================================
# CONFIG
# =============================================================================
$LogicAppUrl = "https://prod-15.westeurope.logic.azure.com:443/workflows/44fbf586eb004c54a92eeaacce8d18ef/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=AAhpQ5cx_ehFuHIxJ_iDWmzl4SRqqqMfnO8TTKfhj3A"
$LogFile     = "$env:TEMP\AVDLauncher.log"

# =============================================================================
# LOGGING
# =============================================================================
function Write-Log {
    param($Msg, $Level = "INFO")
    $line = "$(Get-Date -Format 'HH:mm:ss') [$Level] $Msg"
    Add-Content -Path $LogFile -Value $line -Force
    Write-Output $line
}

Write-Log "=== AVD Launcher Started ==="

# =============================================================================
# STEP 1: RESOLVE USER
# =============================================================================
$UserUPN = $env:USERPRINCIPALNAME

if (-not $UserUPN) {
    try { $UserUPN = (whoami /upn 2>$null).Trim() } catch {}
}
if (-not $UserUPN -and $env:USERNAME -and $env:USERDNSDOMAIN) {
    $UserUPN = "$($env:USERNAME)@$($env:USERDNSDOMAIN)".ToLower()
}

if (-not $UserUPN) {
    Write-Log "Could not resolve UPN" "ERROR"
    exit
}

Write-Log "UPN: $UserUPN"

# =============================================================================
# STEP 2: GET MANAGED IDENTITY TOKEN
# =============================================================================
try {
    $IMDSResponse = Invoke-RestMethod `
        -Uri "http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://management.azure.com/" `
        -Headers @{ Metadata = "true" } `
        -Method Get

    $Token = $IMDSResponse.access_token
    $AuthHeader = @{ Authorization = "Bearer $Token" }

    Write-Log "Managed Identity token acquired"
}
catch {
    Write-Log "IMDS token failed: $_" "ERROR"
    exit
}

# =============================================================================
# STEP 3: QUERY RESOURCE GRAPH
# =============================================================================
$FoundMachine = $null
$FoundRG = $null
$FoundSub = $null
$FoundHealth = "Unknown"
$FoundLastHeartbeat = "Unknown"

try {
    $GraphBody = @{
        query = @"
desktopvirtualizationresources
| where type == "microsoft.desktopvirtualization/hostpools/sessionhosts"
| where properties.assignedUser =~ '$UserUPN'
| project
    machineName    = tostring(split(properties.resourceId, '/')[8]),
    resourceGroup  = tostring(split(id, '/')[4]),
    subscriptionId = tostring(split(id, '/')[2]),
    healthState    = tostring(properties.healthState),
     status         = tostring(properties.status),
     osversion      = tostring(properties.osVersion),
    lastHeartbeat  = tostring(properties.lastHeartBeat)
"@
    } | ConvertTo-Json

    $GraphResponse = Invoke-RestMethod `
        -Uri "https://management.azure.com/providers/Microsoft.ResourceGraph/resources?api-version=2021-03-01" `
        -Method Post `
        -Headers $AuthHeader `
        -Body $GraphBody `
        -ContentType "application/json"

    if ($GraphResponse.data.Count -gt 0) {
        $FoundMachine = $GraphResponse.data.machineName
        $FoundRG      = $GraphResponse.data.resourceGroup
        $FoundSub     = $GraphResponse.data.subscriptionId
        $FoundHealth  = $GraphResponse.data.healthState
        $Foundstatus  = $GraphResponse.data.status
        $Foundosversion= $GraphResponse.data.osversion

        $HBRaw = $GraphResponse.data.lastHeartbeat
        if ($HBRaw) {
            $HBTime = [datetime]$HBRaw
            $Age = (Get-Date).ToUniversalTime() - $HBTime.ToUniversalTime()
            if ($Age.TotalMinutes -lt 2) { $FoundLastHeartbeat = "Just now" }
            else { $FoundLastHeartbeat = "$([int]$Age.TotalMinutes) min ago" }
        }

        Write-Log "Machine: $FoundMachine | Health: $FoundHealth"
    }
    else {
        Write-Log "No assigned desktop found" "WARN"
    }
}
catch {
    Write-Log "Graph query failed: $_" "ERROR"
}

# =============================================================================
# STEP 4: PRE-CHECK
# =============================================================================
$PreCheckMessage = ""

if (-not $FoundMachine) {
    $PreCheckMessage = "No virtual computer assigned."
}
elseif ($Foundstatus -eq "Available") {
    $PreCheckMessage = "Your virtual computer looks healthy. Try reconnecting first."
}
else {
    $PreCheckMessage = "We detected an issue. You can attempt a recovery."
}

# =============================================================================
# STEP 5: UI
# =============================================================================
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$form = New-Object System.Windows.Forms.Form
$form.Text = "Virtual Computer Support"
$form.Size = New-Object System.Drawing.Size(420,320)
$form.StartPosition = "CenterScreen"

# Info Label
$label = New-Object System.Windows.Forms.Label
$label.Text = "Machine: $FoundMachine`nHealth: $FoundHealth`nLast Heartbeat: $FoundLastHeartbeat"
$label.AutoSize = $true
$label.Location = New-Object System.Drawing.Point(20,20)
$form.Controls.Add($label)

# Precheck Label
$preLabel = New-Object System.Windows.Forms.Label
$preLabel.Text = $PreCheckMessage
$preLabel.AutoSize = $true
$preLabel.Location = New-Object System.Drawing.Point(20,100)
$form.Controls.Add($preLabel)

# Status Label
$statusLabel = New-Object System.Windows.Forms.Label
$statusLabel.Text = ""
$statusLabel.AutoSize = $true
$statusLabel.Location = New-Object System.Drawing.Point(20,140)
$form.Controls.Add($statusLabel)

# Button
$button = New-Object System.Windows.Forms.Button
$button.Text = "Fix My Virtual Computer"
$button.Size = New-Object System.Drawing.Size(220,40)
$button.Location = New-Object System.Drawing.Point(90,180)

# Disable button if no machine
if (-not $FoundMachine) {
    $button.Enabled = $false
}

$form.Controls.Add($button)

# =============================================================================
# BUTTON ACTION
# =============================================================================
$button.Add_Click({

    $button.Enabled = $false
    $statusLabel.Text = "Processing request..."

    $body = @{
        User           = $UserUPN
        MachineName    = $FoundMachine
        ResourceGroup  = $FoundRG
        SubscriptionId = $FoundSub
        Action         = "RestartVM"
    } | ConvertTo-Json

    try {
        $response = Invoke-RestMethod `
            -Uri $LogicAppUrl `
            -Method Post `
            -Body $body `
            -ContentType "application/json"

        if ($response.status -eq "Success") {
            $statusLabel.Text = "✅ $($response.message)"
        }
        else {
            $statusLabel.Text = "⚠️ $($response.message)"
        }
    }
    catch {
        $statusLabel.Text = "❌ Failed to contact recovery service"
    }

    $button.Enabled = $true
})

$form.Topmost = $true
$form.Add_Shown({$form.Activate()})
[void]$form.ShowDialog()

Write-Log "=== AVD Launcher Complete ==="
