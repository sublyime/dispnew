# Chemical Dispersion Modeler

A professional ALOHA 5.4.4 compliant chemical dispersion modeling system for emergency response and environmental assessment.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![ALOHA Compliant](https://img.shields.io/badge/ALOHA-5.4.4%20Compliant-green.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

## Features

### 🌪️ Dispersion Modeling
- **ALOHA 5.4.4 Compliant** - NOAA-approved algorithms
- **Gaussian Plume Model** - Standard atmospheric dispersion calculations
- **Heavy Gas Model** - Dense gas dispersion with density corrections
- **Real-time Calculations** - Live plume updates with wind conditions
- **Concentration Mapping** - Detailed concentration contours and isopleths

### 🌤️ Weather Integration
- **NOAA Weather API** - Real-time meteorological data
- **Database Storage** - Historical weather data retention
- **Automatic Updates** - Continuous weather monitoring
- **Stability Class Calculation** - Pasquill-Gifford stability determination

### 🗺️ Interactive Mapping
- **Leaflet Integration** - Professional mapping interface
- **Plume Visualization** - Color-coded concentration levels
- **Layer Controls** - Buildings, topography, receptors, wind vectors
- **Click-to-Place** - Interactive release point and receptor placement
- **Real-time Updates** - Live plume animation

### 🏗️ GIS Support
- **Multi-format Support** - Shapefile, KML/KMZ, GeoJSON, GeoTIFF
- **Building Data** - Structure integration for dispersion modeling
- **Topography** - Elevation data for complex terrain effects
- **Administrative Boundaries** - Jurisdictional overlay support
- **Drag-and-Drop Upload** - Easy GIS data integration

### 🧪 Chemical Database
- **CAMEO Chemicals Integration** - EPA chemical database access
- **Real-time Search** - Chemical property lookup
- **Physical Properties** - Vapor pressure, density, molecular weight
- **Safety Information** - Hazard classifications and recommendations

### 📊 Advanced Features
- **WebSocket Real-time** - Live data streaming
- **Receptor Networks** - Multi-point concentration monitoring
- **Export Capabilities** - Data export and reporting
- **Professional UI** - Responsive design for desktop and mobile

## Installation

### Prerequisites
- Node.js 16+ 
- PostgreSQL 12+ with PostGIS extension
- Git

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/dispnew.git
   cd dispnew
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Database setup**
   ```sql
   CREATE DATABASE chemical_dispersion;
   CREATE EXTENSION postgis;
   ```

4. **Environment configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

5. **Initialize database**
   ```bash
   npm run init-db
   ```

6. **Start the application**
   ```bash
   npm start
   ```

7. **Access the application**
   Open your browser to `http://localhost:3000`

## Environment Variables

Create a `.env` file in the root directory:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=chemical_dispersion
DB_USER=your_username
DB_PASSWORD=your_password

# Server Configuration
PORT=3000
NODE_ENV=development

# API Keys (if required)
WEATHER_API_KEY=your_noaa_api_key
```

## Usage

### Creating a Release Scenario

1. **Set Release Point**: Click on the map to place a chemical release point
2. **Select Chemical**: Choose from CAMEO chemicals database or enter custom properties
3. **Configure Parameters**: Set release rate, duration, and physical conditions
4. **Weather Data**: System automatically fetches current weather conditions
5. **Run Model**: View real-time dispersion calculations and plume visualization

### GIS Data Integration

1. **Upload Files**: Use the GIS upload button to import spatial data
2. **Supported Formats**: Shapefile (.shp+.dbf+.shx), KML/KMZ, GeoJSON, GeoTIFF
3. **Data Types**: Buildings, topography, administrative boundaries
4. **Automatic Integration**: Uploaded data immediately appears on map

### Receptor Monitoring

1. **Place Receptors**: Click receptor button and place monitoring points
2. **View Concentrations**: Real-time concentration values at each receptor
3. **Health Assessment**: Automatic comparison to exposure thresholds

## API Documentation

### Weather API
- `GET /api/weather/current/:lat/:lon` - Current weather conditions
- `GET /api/weather/forecast/:lat/:lon` - Weather forecast data

### Dispersion API
- `POST /api/dispersion/releases` - Create new release scenario
- `GET /api/dispersion/releases/:id/latest` - Latest calculation results
- `PUT /api/dispersion/releases/:id` - Update release parameters

### GIS API
- `POST /api/gis/upload` - Upload GIS files
- `GET /api/gis/buildings` - Retrieve building data
- `GET /api/gis/topography` - Retrieve topography data

### Chemicals API
- `GET /api/chemicals/search` - Search CAMEO chemicals database
- `GET /api/chemicals/:id` - Get chemical properties

## Technical Specifications

### ALOHA Compliance
- **Gaussian Plume Model**: Implements standard ALOHA atmospheric dispersion equations
- **Heavy Gas Model**: Density-corrected calculations for gases heavier than air
- **Stability Classes**: Pasquill-Gifford atmospheric stability determination
- **Wind Profile**: Power law wind speed adjustment with height

### Database Schema
- **PostgreSQL with PostGIS**: Spatial database for geographic data
- **Release Events**: Chemical release scenarios and parameters
- **Weather Data**: Historical and current meteorological conditions
- **Dispersion Calculations**: Calculated plume geometries and concentrations
- **GIS Features**: Buildings, topography, and boundary data

### Performance
- **Real-time Updates**: 30-second calculation intervals
- **WebSocket Communication**: Live data streaming to clients
- **Optimized Queries**: Spatial indexing for fast GIS operations
- **Concurrent Users**: Multi-user support with session management

## Development

### Project Structure
```
dispnew/
├── client/                 # Frontend application
│   ├── css/               # Stylesheets
│   ├── js/                # JavaScript modules
│   └── index.html         # Main application page
├── src/                   # Backend application
│   ├── routes/            # API route handlers
│   ├── services/          # Business logic services
│   └── config/            # Configuration files
├── scripts/               # Utility scripts
└── package.json           # Dependencies and scripts
```

### Key Services
- **DispersionService**: ALOHA-compliant dispersion calculations
- **WeatherService**: NOAA weather API integration
- **GISService**: Spatial data processing
- **CameoChemicalsService**: EPA chemical database integration
- **DatabaseService**: PostgreSQL connection and queries

### Testing
```bash
npm test                   # Run test suite
npm run test:watch        # Watch mode testing
npm run test:coverage     # Coverage reporting
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **NOAA ALOHA**: Algorithm specifications and compliance standards
- **EPA CAMEO**: Chemical database integration
- **OpenStreetMap**: Base mapping data
- **PostGIS**: Spatial database capabilities

## Support

For issues, questions, or contributions:
- Create an issue on GitHub
- Email: support@dispersionmodeler.com
- Documentation: [docs.dispersionmodeler.com](https://docs.dispersionmodeler.com)

---

**Built for Emergency Response and Environmental Protection** 🌍