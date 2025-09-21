# Chemical Water Dispersion Simulation System

A comprehensive system for modeling and analyzing chemical spill dispersion in water environments. This application combines fluid dynamics, weather/tidal data, and chemical properties to simulate and predict the spread of chemical contaminants in aquatic environments.

## 🌊 Project Overview

The Chemical Water Dispersion System is designed to help environmental scientists, emergency responders, and regulatory agencies:

- **Model chemical spill scenarios** in various water environments
- **Predict dispersion patterns** based on fluid dynamics and environmental conditions
- **Track and analyze** chemical contamination spread over time
- **Visualize dispersion data** through an intuitive web interface
- **Store and manage** spill incidents and chemical properties

## 🏗️ Architecture

### System Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Database      │
│   (Blazor WASM) │◄──►│   (.NET 9.0)    │◄──►│   (PostgreSQL)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                    ┌─────────┼─────────┐
                    │         │         │
            ┌───────▼───┐ ┌───▼────┐ ┌──▼──────┐
            │  Domain   │ │ Fluid  │ │ Weather │
            │  Models   │ │Dynamics│ │ & Tidal │
            └───────────┘ └────────┘ └─────────┘
```

### Project Structure

- **`frontend/ChemicalDispersionWater.Blazor/`** - Blazor WebAssembly client application
- **`backend/ChemicalDispersionWater.Api/`** - REST API backend service
- **`backend/ChemicalDispersionWater.Domain/`** - Domain models and business logic
- **`backend/ChemicalDispersionWater.FluidDynamics/`** - Fluid dynamics simulation engine
- **`backend/ChemicalDispersionWater.WeatherTidal/`** - Weather and tidal data services
- **`shared/`** - Shared models and DTOs for client-server communication
- **`db/`** - Database initialization scripts

## 🚀 Quick Start

### Prerequisites

- [.NET 9.0 SDK](https://dotnet.microsoft.com/download)
- [PostgreSQL 12+](https://www.postgresql.org/download/) with PostGIS extension
- [Visual Studio 2022](https://visualstudio.microsoft.com/) or [VS Code](https://code.visualstudio.com/)

### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone https://github.com/sublyime/chemicalwaterdispersion1.git
   cd chemicalwaterdispersion1/ChemicalDispersionWater
   ```

2. **Database Setup**
   ```bash
   # Create PostgreSQL database
   createdb chemical_dispersion_db
   
   # Enable PostGIS extension
   psql -d chemical_dispersion_db -c "CREATE EXTENSION postgis;"
   
   # Initialize database schema
   psql -d chemical_dispersion_db -f db/init-db.sql
   ```

3. **Configure Connection String**
   
   Update `appsettings.Development.json` in the API project:
   ```json
   {
     "ConnectionStrings": {
       "DefaultConnection": "Host=localhost;Database=chemical_dispersion_db;Username=your_username;Password=your_password"
     }
   }
   ```

4. **Build and Run**
   ```bash
   # Restore dependencies and build
   dotnet build
   
   # Run database migrations
   cd backend/ChemicalDispersionWater.Api
   dotnet ef database update
   
   # Start the API (from solution root)
   dotnet run --project backend/ChemicalDispersionWater.Api
   
   # Start the Blazor client (in another terminal)
   dotnet run --project frontend/ChemicalDispersionWater.Blazor
   ```

5. **Access the Application**
   - API: https://localhost:5001
   - Web App: https://localhost:5002

## 📊 Features

### Current Features

- ✅ **Chemical Management**: Add, edit, and manage chemical substances and their properties
- ✅ **Spill Tracking**: Record and track chemical spill incidents with location data
- ✅ **Geospatial Support**: PostGIS integration for accurate location-based modeling
- ✅ **RESTful API**: Complete CRUD operations for spills and chemicals
- ✅ **Entity Framework**: Code-first database migrations and management

### Planned Features

- 🔄 **Dispersion Modeling**: Advanced fluid dynamics calculations
- 🔄 **Weather Integration**: Real-time weather and tidal data
- 🔄 **Visualization**: Interactive maps and dispersion pattern visualization
- 🔄 **Reporting**: Generate detailed contamination reports
- 🔄 **Alert System**: Real-time notifications for critical scenarios

## 🔧 Development

### Technology Stack

- **Backend**: .NET 9.0, ASP.NET Core Web API, Entity Framework Core
- **Frontend**: Blazor WebAssembly, C#
- **Database**: PostgreSQL with PostGIS extension
- **Mapping**: NetTopologySuite for geospatial operations
- **Containerization**: Docker support (planned)

### API Endpoints

#### Spills Management
- `GET /api/spill` - Get all spills
- `GET /api/spill/{id}` - Get spill by ID
- `POST /api/spill` - Create new spill
- `PUT /api/spill/{id}` - Update existing spill
- `DELETE /api/spill/{id}` - Delete spill

#### Chemicals Management
- Chemical CRUD operations (implementation in progress)

### Database Schema

#### Key Tables
- **`chemicals`** - Chemical substance definitions and properties
- **`spills`** - Spill incident records with geospatial data
- **`weather`** - Weather and environmental condition data

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow C# coding standards and conventions
- Write unit tests for new features
- Update documentation for API changes
- Use meaningful commit messages
- Ensure all tests pass before submitting PRs

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in the GitHub repository
- Contact the development team
- Check the [documentation](docs/) for detailed guides

## 🔮 Roadmap

- **Phase 1**: Complete basic CRUD operations and UI ✅
- **Phase 2**: Implement fluid dynamics engine 🔄
- **Phase 3**: Add weather/tidal data integration
- **Phase 4**: Advanced visualization and reporting
- **Phase 5**: Machine learning predictions
- **Phase 6**: Mobile application support

---

*Built with ❤️ for environmental protection and emergency response*