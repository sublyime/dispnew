using System;

namespace ChemicalDispersionWater.SharedModels.DTOs
{
    public class SpillDto
    {
        public int Id { get; set; }
        public int ChemicalId { get; set; }
        public double Volume { get; set; }
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
        public DateTime Timestamp { get; set; }
        public string? ChemicalName { get; set; }
    }
}