using NetTopologySuite.Geometries;
using System;

namespace ChemicalDispersionWater.Domain.Models
{
    public class Spill
    {
        public int Id { get; set; }
        public int ChemicalId { get; set; }
        public double Volume { get; set; }
        public Point? Location { get; set; }  // Made nullable to avoid warning
        public DateTime Timestamp { get; set; }

        public Chemical Chemical { get; set; } = null!;  // Assume this is always set
    }
}
