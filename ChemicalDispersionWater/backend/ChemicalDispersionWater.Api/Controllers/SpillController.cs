using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ChemicalDispersionWater.Api.Data;
using ChemicalDispersionWater.Domain.Models;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace ChemicalDispersionWater.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SpillController : ControllerBase
    {
        private readonly ChemicalDispersionDbContext _context;

        public SpillController(ChemicalDispersionDbContext context)
        {
            _context = context;
        }

        // GET: api/spill
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Spill>>> GetSpills()
        {
            return await _context.Spills.Include(s => s.Chemical).ToListAsync();
        }

        // GET: api/spill/5
        [HttpGet("{id}")]
        public async Task<ActionResult<Spill>> GetSpill(int id)
        {
            var spill = await _context.Spills.Include(s => s.Chemical).FirstOrDefaultAsync(s => s.Id == id);
            if (spill == null)
                return NotFound();

            return spill;
        }

        // POST: api/spill
        [HttpPost]
        public async Task<ActionResult<Spill>> CreateSpill(Spill spill)
        {
            _context.Spills.Add(spill);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetSpill), new { id = spill.Id }, spill);
        }

        // PUT: api/spill/5
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateSpill(int id, Spill spill)
        {
            if (id != spill.Id)
                return BadRequest();

            _context.Entry(spill).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!await _context.Spills.AnyAsync(e => e.Id == id))
                    return NotFound();
                else
                    throw;
            }

            return NoContent();
        }

        // DELETE: api/spill/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteSpill(int id)
        {
            var spill = await _context.Spills.FindAsync(id);
            if (spill == null)
                return NotFound();

            _context.Spills.Remove(spill);
            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}
