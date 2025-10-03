# Chemical Dispersion Modeler

A comprehensive web-based application for modeling chemical dispersions in urban environments using real-time weather data, topography, and building information.

## Features

- **Real-time Weather Integration**: Connect to weather.gov API or local weather stations
- **3D Mapping**: Interactive maps with topography and 3D building visualization
- **Physics-based Modeling**: Fluid dynamics calculations considering urban topography
- **Chemical Database**: Comprehensive database of chemical properties
- **GIS Integration**: Import custom GIS imagery and geospatial files
- **Real-time Updates**: Dynamic plume updates every 30 seconds
- **Receptor Analysis**: Downwind impact assessment and monitoring

## Technology Stack

- **Backend**: Node.js with Express
- **Database**: PostgreSQL
- **Frontend**: HTML5, CSS3, JavaScript with mapping libraries
- **Real-time Communication**: WebSockets
- **GIS Processing**: GDAL and Proj4

## Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables (see .env.example)
4. Initialize database schema
5. Start the application: `npm run dev`

## Database Configuration

- Username: postgres
- Password: ala1nna
- Database: dispersion

## Usage

1. Access the web interface
2. Click on the map to select release location
3. Choose chemical and release parameters
4. Monitor real-time dispersion modeling with receptor analysis

## License

MIT