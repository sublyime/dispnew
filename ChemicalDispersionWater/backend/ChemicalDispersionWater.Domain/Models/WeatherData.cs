using System;

namespace ChemicalDispersionWater.Domain.Models
{
    public class WeatherData
    {
        public int Id { get; set; }
        public DateTime MeasurementTime { get; set; }
        public double Temperature { get; set; }
        public double WindSpeed { get; set; }
    }
}
