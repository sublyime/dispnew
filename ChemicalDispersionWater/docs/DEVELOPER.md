# Developer Guide

## Development Environment Setup

### Prerequisites

1. **Development Tools**
   - [Visual Studio 2022](https://visualstudio.microsoft.com/) (Community edition or higher) OR
   - [Visual Studio Code](https://code.visualstudio.com/) with C# extension
   - [.NET 9.0 SDK](https://dotnet.microsoft.com/download)

2. **Database**
   - [PostgreSQL 12+](https://www.postgresql.org/download/)
   - [PostGIS Extension](https://postgis.net/install/)

3. **Optional Tools**
   - [pgAdmin](https://www.pgadmin.org/) for database management
   - [Postman](https://www.postman.com/) for API testing
   - [Git](https://git-scm.com/) for version control

### Initial Setup

1. **Clone and Setup Repository**
   ```bash
   git clone https://github.com/sublyime/chemicalwaterdispersion1.git
   cd chemicalwaterdispersion1/ChemicalDispersionWater
   ```

2. **Database Configuration**
   ```bash
   # Create database
   createdb chemical_dispersion_db
   
   # Enable PostGIS
   psql -d chemical_dispersion_db -c "CREATE EXTENSION postgis;"
   ```

3. **Configure User Secrets (Recommended)**
   ```bash
   cd backend/ChemicalDispersionWater.Api
   dotnet user-secrets init
   dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost;Database=chemical_dispersion_db;Username=your_username;Password=your_password"
   ```

4. **Install Dependencies and Build**
   ```bash
   dotnet restore
   dotnet build
   ```

5. **Run Database Migrations**
   ```bash
   cd backend/ChemicalDispersionWater.Api
   dotnet ef database update
   ```

## Development Workflow

### Project Structure

```
ChemicalDispersionWater/
├── backend/
│   ├── ChemicalDispersionWater.Api/           # Web API
│   ├── ChemicalDispersionWater.Domain/        # Domain models
│   ├── ChemicalDispersionWater.FluidDynamics/ # Simulation engine
│   └── ChemicalDispersionWater.WeatherTidal/  # Weather services
├── frontend/
│   └── ChemicalDispersionWater.Blazor/        # Blazor WebAssembly
├── shared/
│   └── ChemicalDispersionWater.SharedModels/  # Shared DTOs
├── docs/                                      # Documentation
└── db/                                        # Database scripts
```

### Running the Application

1. **Start the API (Terminal 1)**
   ```bash
   cd backend/ChemicalDispersionWater.Api
   dotnet run
   ```
   API will be available at: https://localhost:5001

2. **Start the Blazor App (Terminal 2)**
   ```bash
   cd frontend/ChemicalDispersionWater.Blazor
   dotnet run
   ```
   Web app will be available at: https://localhost:5002

### Development Guidelines

#### Code Style

- Follow [Microsoft C# Coding Conventions](https://docs.microsoft.com/en-us/dotnet/csharp/programming-guide/inside-a-program/coding-conventions)
- Use meaningful variable and method names
- Add XML documentation comments for public APIs
- Use nullable reference types where appropriate

#### Git Workflow

1. **Feature Development**
   ```bash
   git checkout -b feature/your-feature-name
   # Make changes
   git add .
   git commit -m "feat: add your feature description"
   git push origin feature/your-feature-name
   ```

2. **Commit Message Convention**
   - `feat:` for new features
   - `fix:` for bug fixes
   - `docs:` for documentation changes
   - `refactor:` for code refactoring
   - `test:` for adding tests
   - `chore:` for maintenance tasks

#### Database Migrations

When modifying domain models:

1. **Add Migration**
   ```bash
   cd backend/ChemicalDispersionWater.Api
   dotnet ef migrations add YourMigrationName
   ```

2. **Update Database**
   ```bash
   dotnet ef database update
   ```

3. **Remove Last Migration (if needed)**
   ```bash
   dotnet ef migrations remove
   ```

## Testing

### Unit Tests

Create unit tests in corresponding test projects:

```bash
# Create test project
dotnet new xunit -n ChemicalDispersionWater.Api.Tests
cd ChemicalDispersionWater.Api.Tests
dotnet add reference ../backend/ChemicalDispersionWater.Api
```

### Integration Tests

Test API endpoints using the built-in test framework:

```csharp
[Fact]
public async Task GetSpills_ReturnsOkResult()
{
    // Arrange
    var client = _factory.CreateClient();
    
    // Act
    var response = await client.GetAsync("/api/spill");
    
    // Assert
    response.EnsureSuccessStatusCode();
}
```

### Manual API Testing

Use the included HTTP file:

```
GET https://localhost:5001/api/spill
Content-Type: application/json

###

POST https://localhost:5001/api/spill
Content-Type: application/json

{
  "chemicalId": 1,
  "volume": 100.5,
  "location": {
    "type": "Point",
    "coordinates": [-122.4194, 37.7749]
  },
  "timestamp": "2025-09-21T10:30:00Z"
}
```

## Debugging

### Visual Studio

1. Set `ChemicalDispersionWater.Api` as startup project
2. Press F5 to start debugging
3. Set breakpoints in controllers or services

### Visual Studio Code

1. Open the project folder
2. Use the built-in debugger (F5)
3. Configure launch.json for multiple projects

### Common Issues

1. **Database Connection Errors**
   - Verify PostgreSQL is running
   - Check connection string in appsettings.json
   - Ensure database exists and PostGIS is installed

2. **Port Conflicts**
   - Change ports in launchSettings.json
   - Use `dotnet run --urls "https://localhost:5003"`

3. **CORS Issues**
   - API includes CORS configuration for local development
   - For production, update CORS settings in Program.cs

## Performance Considerations

### Entity Framework

- Use `Include()` for related data to avoid N+1 queries
- Consider using `AsNoTracking()` for read-only queries
- Implement pagination for large datasets

```csharp
// Good
var spills = await _context.Spills
    .Include(s => s.Chemical)
    .AsNoTracking()
    .Take(50)
    .ToListAsync();
```

### API Design

- Use DTOs for data transfer to avoid over-posting
- Implement proper error handling
- Add logging for debugging and monitoring

## Contributing

### Pull Request Process

1. **Fork the Repository**
2. **Create Feature Branch**
3. **Make Changes with Tests**
4. **Update Documentation**
5. **Submit Pull Request**

### Code Review Checklist

- [ ] Code follows style guidelines
- [ ] All tests pass
- [ ] Documentation updated
- [ ] No breaking changes (or properly documented)
- [ ] Performance considerations addressed

### Issue Reporting

When reporting bugs:

1. **Environment Details**
   - OS and version
   - .NET version
   - Database version

2. **Steps to Reproduce**
3. **Expected vs Actual Behavior**
4. **Error Messages/Stack Traces**

## Advanced Topics

### Adding New Endpoints

1. **Create Controller Method**
   ```csharp
   [HttpGet("by-chemical/{chemicalId}")]
   public async Task<ActionResult<IEnumerable<Spill>>> GetSpillsByChemical(int chemicalId)
   {
       return await _context.Spills
           .Where(s => s.ChemicalId == chemicalId)
           .Include(s => s.Chemical)
           .ToListAsync();
   }
   ```

2. **Add to Blazor Service**
   ```csharp
   public async Task<List<SpillDto>> GetSpillsByChemicalAsync(int chemicalId)
   {
       return await _http.GetFromJsonAsync<List<SpillDto>>($"api/spill/by-chemical/{chemicalId}") 
              ?? new List<SpillDto>();
   }
   ```

3. **Update Documentation**

### Extending Domain Models

1. **Add Properties to Domain Model**
2. **Create Migration**
3. **Update DTOs**
4. **Update Controllers**
5. **Add Tests**

## Resources

- [ASP.NET Core Documentation](https://docs.microsoft.com/en-us/aspnet/core/)
- [Entity Framework Core Documentation](https://docs.microsoft.com/en-us/ef/core/)
- [Blazor Documentation](https://docs.microsoft.com/en-us/aspnet/core/blazor/)
- [PostGIS Documentation](https://postgis.net/documentation/)
- [NetTopologySuite Documentation](https://nettopologysuite.github.io/NetTopologySuite/)