using System.Net.Http.Json;
using System.Threading.Tasks;
using System.Collections.Generic;
using ChemicalDispersionWater.SharedModels.DTOs; // Use shared DTOs

public class SpillService
{
    private readonly HttpClient _http;

    public SpillService(HttpClient http)
    {
        _http = http;
    }

    public async Task<List<SpillDto>> GetSpillsAsync()
    {
        return await _http.GetFromJsonAsync<List<SpillDto>>("api/spill") ?? new List<SpillDto>();
    }

    public async Task<SpillDto?> GetSpillAsync(int id)
    {
        return await _http.GetFromJsonAsync<SpillDto>($"api/spill/{id}");
    }

    public async Task CreateSpillAsync(SpillDto spill)
    {
        await _http.PostAsJsonAsync("api/spill", spill);
    }

    public async Task UpdateSpillAsync(SpillDto spill)
    {
        await _http.PutAsJsonAsync($"api/spill/{spill.Id}", spill);
    }

    public async Task DeleteSpillAsync(int id)
    {
        await _http.DeleteAsync($"api/spill/{id}");
    }
}
