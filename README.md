# AVD Self-Service Recovery Tool

A self-service desktop troubleshooting solution for Azure Virtual Desktop (AVD) environments that empowers users to resolve common issues without IT intervention.

## 🎯 Project Overview

This tool provides an automated recovery system for AVD environments, allowing users to troubleshoot and fix their virtual desktops through a simple Windows application interface. The system leverages Azure Logic Apps, Automation Accounts, and Function Apps to execute recovery procedures while maintaining comprehensive logging and monitoring.

## 🏗️ Architecture

```
User → Windows App → AVD Recovery Tool → Logic App
                                            ├→ Automation Account (Runbooks)
                                            └→ Function App (Recovery Scripts)
                                                    ↓
                                            Log Analytics → Dashboard
                                                    ↓
                                         Success? Yes → Resolved
                                                  No → Raise Incident
```

See [Architecture Diagram](./docs/architecture-flowchart.svg) for detailed workflow.

## ✨ Features

- **Self-Service Interface**: User-friendly Windows application
- **Multi-Host Pool Support**: Manage multiple AVD host pools
- **Automated Recovery**: Intelligent troubleshooting workflows
- **Comprehensive Logging**: All activities tracked in Log Analytics
- **Real-time Dashboard**: Monitor recovery status and metrics
- **Incident Management**: Automatic ticket creation for unresolved issues

## 📋 Prerequisites

- Azure Subscription
- AVD Environment (one or more host pools)
- Azure Logic Apps
- Azure Automation Account
- Azure Function App
- Log Analytics Workspace
- Permissions to deploy Azure resources

## 🚀 Getting Started

### Repository Structure

```
avd-self-service-recovery/
├── docs/                           # Documentation
│   ├── architecture-flowchart.svg
│   ├── setup-guide.md
│   └── user-guide.md
├── src/
│   ├── windows-app/               # Windows application code
│   │   ├── UI/
│   │   ├── Services/
│   │   └── Models/
│   ├── logic-apps/                # Logic App definitions
│   │   └── avd-recovery-workflow.json
│   ├── automation/                # Automation Account runbooks
│   │   ├── Restart-AVDSessionHost.ps1
│   │   ├── Reset-UserProfile.ps1
│   │   └── Clear-AVDCache.ps1
│   ├── functions/                 # Azure Function App code
│   │   ├── DiagnosticCheck/
│   │   ├── RecoveryOrchestrator/
│   │   └── NotificationService/
│   └── infrastructure/            # IaC templates
│       ├── bicep/
│       └── terraform/
├── tests/                         # Test files
│   ├── unit/
│   └── integration/
├── .github/
│   └── workflows/                 # CI/CD pipelines
│       ├── build-windows-app.yml
│       ├── deploy-logic-apps.yml
│       └── deploy-functions.yml
├── .gitignore
├── LICENSE
└── README.md
```

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/avd-self-service-recovery.git
   cd avd-self-service-recovery
   ```

2. **Deploy Azure Infrastructure**
   ```bash
   # Using Bicep
   az deployment sub create --location eastus --template-file ./src/infrastructure/bicep/main.bicep
   
   # OR using Terraform
   cd ./src/infrastructure/terraform
   terraform init
   terraform plan
   terraform apply
   ```

3. **Deploy Logic Apps**
   ```bash
   az logic workflow create --resource-group <rg-name> --definition @./src/logic-apps/avd-recovery-workflow.json
   ```

4. **Deploy Azure Functions**
   ```bash
   cd ./src/functions
   func azure functionapp publish <function-app-name>
   ```

5. **Build and Deploy Windows App**
   ```bash
   cd ./src/windows-app
   dotnet build
   # Publish to your distribution channel
   ```

## 🔧 Configuration

1. **Update App Settings**: Configure the `appsettings.json` in the Windows app with your Azure resource details
2. **Configure Logic Apps**: Set connection strings and API endpoints
3. **Set Up Log Analytics**: Configure workspace ID and key
4. **Configure Automation Account**: Import and publish runbooks

See [Setup Guide](./docs/setup-guide.md) for detailed configuration instructions.

## 📊 Monitoring

The solution includes a comprehensive monitoring dashboard that tracks:
- Recovery success rates
- Most common issues
- Average resolution time
- Active incidents
- Host pool health status

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 🧪 Testing

```bash
# Run unit tests
dotnet test ./tests/unit

# Run integration tests
dotnet test ./tests/integration
```

## 📝 Roadmap

- [ ] Phase 1: Basic recovery workflows (Q2 2026)
- [ ] Phase 2: Enhanced diagnostics (Q3 2026)
- [ ] Phase 3: Machine learning for predictive maintenance (Q4 2026)
- [ ] Phase 4: Mobile app support (Q1 2027)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Authors

- Your Name - Initial work

## 🙏 Acknowledgments

- Azure Virtual Desktop team
- Community contributors

## 📞 Support

For issues and questions:
- Create an [Issue](https://github.com/yourusername/avd-self-service-recovery/issues)
- Check our [Wiki](https://github.com/yourusername/avd-self-service-recovery/wiki)
- Contact: your.email@company.com

## 🔐 Security

Please report security vulnerabilities to security@yourcompany.com

---

**Status**: 🚧 In Development | **Version**: 0.1.0-alpha
