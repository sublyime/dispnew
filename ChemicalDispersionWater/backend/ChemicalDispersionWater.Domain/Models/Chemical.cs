namespace ChemicalDispersionWater.Domain.Models
{
    public class Chemical
    {
        public int Id { get; set; }
        public string Name { get; set; } = null!;  // Non-nullable with default to satisfy compiler
        public string? Description { get; set; }
        public string? CASNumber { get; set; }    // Chemical Abstracts Service Registry Number

        // Additional chemical properties can be added here, for example:
        // public double MolecularWeight { get; set; }
        // public string PhysicalState { get; set; }
        // public string HazardInformation { get; set; }
    }
}
