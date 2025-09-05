using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using ChemicalDispersionWater.Domain.Models;

namespace ChemicalDispersionWater.Api.Data
{
    public class ChemicalDispersionDbContext : DbContext
    {
        public ChemicalDispersionDbContext(DbContextOptions<ChemicalDispersionDbContext> options)
            : base(options)
        {
        }

        public DbSet<Spill> Spills { get; set; }
        public DbSet<Chemical> Chemicals { get; set; }
        public DbSet<WeatherData> Weather { get; set; }
        public DbSet<TideInfo> Tides { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            // Map spatial types if needed
            modelBuilder.Entity<Spill>(entity =>
            {
                entity.Property(e => e.Location).HasColumnType("geometry");
            });

            // Additional model configuration as needed
        }
    }
}
