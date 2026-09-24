import { describe, it } from 'vitest';

const html = [
  '<tr class="js-tournament"><th class="h-text-left" colspan="2"><a href="/basketball/chile/lnb/" class="table-main__tournament"><i><img src="https://cci.betexplorer.com/cl.svg" alt="Chile"></i>Chile: LNB</a></th><th class="table-main__odds">&nbsp;</th></tr>',
  '<tr data-fro="0" data-dt="25,9,2026,0,00" data-def="1">',
  '<td class="table-main__tt"><span class="table-main__time">00:00</span><a href="/basketball/chile/lnb/ancud-puerto-montt/6qy8POOs/" class="table-main__teamsLink table-main__teamsLink--msv2"><span class="table-main__teamLine table-main__teamLine--home">Ancud</span><span class="table-main__teamLine table-main__teamLine--away">Puerto Montt</span></a></td>',
  '<td class="table-main__streams"></td>',
  '<td class="table-main__odds " data-oid="a"><button data-odd="1.56"></button></td>',
  '</tr>'
].join('\n');

describe('debug', () => {
  it('logs', () => {
    const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? [];
    console.log('rows', rows.length);
    rows.forEach((r, i) => console.log('  row' + i + ': ' + r.slice(0, 90).replace(/\s+/g, ' ')));
    const tourneyRe = /class="table-main__tournament"[^>]*>([\s\S]*?)<\/a>/;
    rows.forEach((r, i) => console.log('  tourney' + i + ': ' + JSON.stringify(r.match(tourneyRe)?.[1]?.slice(0, 60) ?? null)));
    const openTag = rows[1] ? rows[1].slice(0, rows[1].indexOf('>') + 1) : '';
    console.log('openTag', JSON.stringify(openTag));
    const dt = openTag.match(/data-dt="([^"]+)"/);
    console.log('dt', dt?.[1]);
    const TT = /<td class="table-main__tt"[\s\S]*?<\/td>/;
    const cell = rows[1]?.match(TT)?.[0] ?? '';
    console.log('cell', JSON.stringify(cell.slice(0, 120)));
    const H = /<span class="table-main__teamLine[^"]*table-main__teamLine--home[^"]*">([\s\S]*?)<\/span>/;
    const A = /<span class="table-main__teamLine[^"]*table-main__teamLine--away[^"]*">([\s\S]*?)<\/span>/;
    console.log('home', JSON.stringify(cell.match(H)?.[1] ?? null));
    console.log('away', JSON.stringify(cell.match(A)?.[1] ?? null));
  });
});
