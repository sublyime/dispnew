using System.Net.Http.Json;
using System.Threading.Tasks;
using System.Collections.Generic;
using ChemicalDispersionWater.Domain.Models; // Use shared models or DTOs

public class SpillService
{
    private readonly HttpClient _http;

    public SpillService(HttpClient http)
    {
        _http = http;
    }

    public async Task<List<Spill>> GetSpillsAsync()
    {
        return await _http.GetFromJsonAsync<List<Spill>>("api/spill");
    }

    public async Task<Spill> GetSpillAsync(int id)
    {
        return await _http.GetFromJsonAsync<Spill>($"api/spill/{id}");
    }

    public async Task CreateSpillAsync(Spill spill)
    {
        await _http.PostAsJsonAsync("api/spill", spill);
    }

    public async Task UpdateSpillAsync(Spill spill)
    {
        await _http.PutAsJsonAsync($"api/spill/{spill.Id}", spill);
    }

    public async Task DeleteSpillAsync(int id)
    {
        await _http.DeleteAsync($"api/spill/{id}");
    }
}
