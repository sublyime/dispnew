using System;

namespace ChemicalDispersionWater.Domain.Models
{
    public class TideInfo
    {
        public int Id { get; set; }
        public DateTime MeasurementTime { get; set; }
        public double TidalHeight { get; set; }
    }
}
