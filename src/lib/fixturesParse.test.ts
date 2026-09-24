import { describe, it, expect } from 'vitest';
import { parseFixtures } from '../../convex/scrapers/fixtures';

describe('parseFixtures (convex scrapers)', () => {
  it('parses BetExplorer table rows with real decimal odds', () => {
    const text = [
      '| _![Image 1: Colombia](https://cci.betexplorer.com/co.svg)_ Colombia: Primera A](https://www.betexplorer.com/football/colombia/primera-a/) | 1 | X | 2 |',
      '| --- | --- | --- | --- |',
      '| 03:20[Millonarios - Dep. Pasto](https://www.betexplorer.com/football/colombia/primera-a/millonarios-dep-pasto/SYLyrJJa/) | 1.85 | 3.40 | 2.10 |',
      '| 04:00[Antigua - Esteli](https://www.betexplorer.com/football/north-central-america/concacaf-central-american-cup/antigua-esteli/vwupev4c/) | 2.10 | 3.20 | 3.60 |'
    ].join('\n');

    const matches = parseFixtures(text, 'football', 'https://www.betexplorer.com/football/next/');
    expect(matches.length).toBe(2);
    expect(matches[0].homeTeam).toContain('Millonarios');
    expect(matches[0].awayTeam).toContain('Pasto');
    expect(matches[0].sourceUrl).toBe('https://www.betexplorer.com/football/next/');
    expect(matches[0].oddsText).toBe('1.85, 3.40, 2.10');
    expect(matches[1].oddsText).toBe('2.10, 3.20, 3.60');
  });

  it('parses SoccerVista markdown-link rows and strips trailing form tokens', () => {
    const text = [
      '![Image 14: Country flag](https://www.soccervista.com/images/flags/world.png)[Africa: Africa Cup of Nations Women](https://www.soccervista.com/africa/africa-cup-of-nations-women/0Q2H9Ccm/)',
      '[20:00](https://www.soccervista.com/event/egypt-nigeria/KI0jESwq/)[L L W L W Egypt W](https://www.soccervista.com/event/egypt-nigeria/KI0jESwq/)[](https://www.soccervista.com/event/egypt-nigeria/KI0jESwq/)[Nigeria W W L W W W](https://www.soccervista.com/event/egypt-nigeria/KI0jESwq/)[10 on NGA](https://www.soccervista.com/event/egypt-nigeria/KI0jESwq/)'
    ].join('\n');

    const matches = parseFixtures(text, 'football', 'https://www.soccervista.com/predictions/');
    expect(matches.length).toBe(1);
    expect(matches[0].homeTeam).toBe('Egypt');
    expect(matches[0].awayTeam).toBe('Nigeria');
    expect(matches[0].league).toContain('Africa Cup of Nations');
  });

  it('parses plain "TeamA - TeamB" lines that carry fixture evidence (odds)', () => {
    const text = 'Villarreal - Levante 1.85 3.40 2.10\nAustria Vienna W - Hajduk Split W 2.10 3.20 3.60';
    const matches = parseFixtures(text, 'football', 'https://www.betexplorer.com/football/');
    expect(matches.length).toBe(2);
    expect(matches[0].homeTeam).toContain('Villarreal');
  });

  it('never turns a competition menu into a fixture (league-name sides, no odds)', () => {
    // Verbatim from the converted markdown of betexplorer.com/football/
    // ("Belgium 8" section listing its sub-leagues) — there is no fixture here.
    const text = [
      '   Belgium 8  ',
      '   National Division 1 - ACFF 2   ',
      '   National Division 1 - VV 2   ',
      '   Germany: Regionalliga - Nordost   '
    ].join('\n');
    const matches = parseFixtures(text, 'football', 'https://www.betexplorer.com/football/');
    expect(matches.length).toBe(0);
  });

  it('anchors kickoff times to the target dayKey in West Africa Time', () => {
    const text = '| 03:20[Millonarios - Dep. Pasto](https://www.betexplorer.com/football/colombia/primera-a/millonarios-dep-pasto/SYLyrJJa/) | 1.85 | 3.40 | 2.10 |';
    const matches = parseFixtures(text, 'football', 'https://www.betexplorer.com/football/next/', '2026-08-10');
    expect(matches.length).toBe(1);
    // WAT 2026-08-10 03:20 == UTC 2026-08-10 02:20 (WAT is UTC+1, fixed).
    expect(new Date(matches[0].startTime).toISOString().slice(0, 16)).toBe('2026-08-10T02:20');
  });

  it('rejects odds-shaped opponents ("team vs odd")', () => {
    const bad = '[20:00](https://www.soccervista.com/event/egypt-nigeria/KI0jESwq/)[Egypt W](https://www.soccervista.com/event/egypt-nigeria/KI0jESwq/)[10 on NGA](https://www.soccervista.com/event/egypt-nigeria/KI0jESwq/)';
    const matches = parseFixtures(bad, 'football', 'https://www.soccervista.com/predictions/');
    expect(matches.some((m) => /^\d/.test(m.awayTeam) || / on /.test(m.awayTeam))).toBe(false);
  });

  it('never mislabels cross-sport rows with another sport league (no NBA/ITTF poisoning)', () => {
    // A football-style line parsed under basketball must be dropped, not tagged 'NBA'.
    const footballText = 'Arsenal - Chelsea 2.10 3.30 3.60';
    const hoops = parseFixtures(footballText, 'basketball', 'https://www.betexplorer.com/basketball/next/');
    expect(hoops.some((m) => m.league === 'NBA')).toBe(false);

    // A genuine basketball row without a league header gets an honest label.
    const legit = 'Lakers - Celtics 1.90 2.00';
    const legitHoops = parseFixtures(legit, 'basketball', 'https://www.betexplorer.com/basketball/next/');
    expect(legitHoops.length).toBe(1);
    expect(legitHoops[0].league).toBe('Basketball');
  });

  it('parses raw BetExplorer HTML tables with country-prefixed league context', () => {
    const html = [
      '<table>',
      '<tr class="js-tournament"><th class="h-text-left" colspan="2"><a href="/football/asia/afc-champions-league/" class="table-main__tournament"><i><img src="https://cci.betexplorer.com/5.svg" alt="Asia"></i>Asia: AFC Champions League</a></th><th class="table-main__odds">1</th><th class="table-main__odds">X</th><th class="table-main__odds">2</th></tr>',
      '<tr data-dt="11,8,2026,17,00">',
      '<td class="h-text-left"><span class="table-main__time">17:00</span><a href="/football/asia/afc-champions-league/al-jazira-al-ittihad/ILHMildL/">Al Jazira - Al Ittihad</a></td>',
      '<td class="table-main__streams h-text-right"></td>',
      '<td class="table-main__odds " data-oid="a"><button data-odd="3.71"></button></td>',
      '<td class="table-main__odds " data-oid="b"><button data-odd="3.69"></button></td>',
      '<td class="table-main__odds " data-oid="c"><button data-odd="1.86"></button></td>',
      '</tr>',
      '<tr class="js-tournament"><th class="h-text-left" colspan="2"><a href="/football/czech-republic/mol-cup/" class="table-main__tournament"><i><img src="https://cci.betexplorer.com/cz.svg" alt="Czech Republic"></i>Czech Republic: MOL Cup</a></th></tr>',
      '<tr data-dt="11,8,2026,17,30">',
      '<td class="h-text-left"><span class="table-main__time">17:30</span><a href="/football/czech-republic/mol-cup/hostoun-sk-kladno/xU0OWDIj/">Hostoun - SK Kladno</a></td>',
      '<td class="table-main__odds " data-oid="d"><button data-odd="5.62"></button></td>',
      '<td class="table-main__odds " data-oid="e"><button data-odd="4.41"></button></td>',
      '<td class="table-main__odds " data-oid="f"><button data-odd="1.45"></button></td>',
      '</tr>',
      '</table>'
    ].join('\n');

    const matches = parseFixtures(html, 'football', 'https://www.betexplorer.com/football/', undefined, { trustLeagueHeaders: true });
    expect(matches.length).toBe(2);

    const [first, second] = matches;
    expect(first.homeTeam).toBe('Al Jazira');
    expect(first.awayTeam).toBe('Al Ittihad');
    expect(first.league).toContain('Asia: AFC Champions League');
    expect(first.oddsText).toBe('3.71, 3.69, 1.86');
    // data-dt 11,8,2026 17:00 WAT == UTC 16:00 same day.
    expect(new Date(first.startTime).toISOString().slice(0, 16)).toBe('2026-08-11T16:00');

    // A data-dt on the wrong date gets re-anchored onto the target dayKey so
    // the fixture never splits the cache across two day keys.
    const anchored = parseFixtures(html, 'football', 'https://www.betexplorer.com/football/', '2026-08-11', { trustLeagueHeaders: true });
    expect(anchored.length).toBe(2);
    expect(new Date(anchored[0].startTime).toISOString().slice(0, 16)).toBe('2026-08-11T16:00');

    // League context flows from header to the rows below it — no one-constant-league.
    expect(second.league).toContain('Czech Republic: MOL Cup');
    expect(second.homeTeam).toBe('Hostoun');
    expect(second.awayTeam).toBe('SK Kladno');
  });

  it('drops HTML rows with odds-shaped or non-team opponents', () => {
    const html = [
      '<tr data-dt="11,8,2026,17,00">',
      '<td><span class="table-main__time">17:00</span><a href="/football/x/y/z/">Real Madrid - 2.10</a></td>',
      '<td class="table-main__odds"><button data-odd="1.20"></button></td>',
      '</tr>'
    ].join('\n');
    const matches = parseFixtures(html, 'football', 'https://www.betexplorer.com/football/');
    expect(matches.some((m) => m.awayTeam === '2.10' || /^\d/.test(m.awayTeam))).toBe(false);
  });

  it('parses the msv2 next-page table rows (basketball/tennis/hockey/baseball)', () => {
    // Trimmed real markup from betexplorer.com/next/basketball/?day=25&month=9&year=2026
    const html = [
      '<tr class="js-tournament"><th class="h-text-left" colspan="2"><a href="/basketball/chile/lnb/" class="table-main__tournament"><i><img src="https://cci.betexplorer.com/cl.svg" alt="Chile"></i>Chile: LNB</a></th><th class="table-main__odds">&nbsp;</th></tr>',
      '<tr data-fro="0" data-dt="25,9,2026,0,00" data-def="1">',
      '<td class="table-main__tt"><span class="table-main__time">00:00</span><a href="/basketball/chile/lnb/ancud-puerto-montt/6qy8POOs/" class="table-main__teamsLink table-main__teamsLink--msv2"><span class="table-main__teamLine table-main__teamLine--home">Ancud</span><span class="table-main__teamLine table-main__teamLine--away">Puerto Montt</span></a></td>',
      '<td class="table-main__streams"></td>',
      '<td class="table-main__odds " data-oid="a"><button data-odd="1.56"></button></td>',
      '<td class="table-main__odds " data-oid="b"><button data-odd="2.40"></button></td>',
      '</tr>',
      // Finished row — a result must never be cached as a fixture.
      '<tr data-fro="0" data-dt="25,9,2026,1,00" data-def="0">',
      '<td class="table-main__tt"><span class="table-main__time table-main__time--fin">FIN</span><a href="/basketball/usa/wnba/new-york-liberty-atlanta-dream/fw5vAFzA/" class="table-main__teamsLink table-main__teamsLink--msv2"><span class="table-main__teamLine table-main__teamLine--home">New York Liberty W</span><span class="table-main__teamLine table-main__teamLine--away">Atlanta Dream W</span></a></td>',
      '<td class="table-main__result"><a href="#"><strong>65:83</strong></a></td>',
      '</tr>',
      // Another day's row — must not leak into this dayKey.
      '<tr data-dt="26,9,2026,18,00">',
      '<td class="table-main__tt"><span class="table-main__time">18:00</span><a href="/basketball/spain/acb/real-madrid-barca/x/" class="table-main__teamsLink table-main__teamsLink--msv2"><span class="table-main__teamLine table-main__teamLine--home">Real Madrid</span><span class="table-main__teamLine table-main__teamLine--away">Barca</span></a></td>',
      '</tr>'
    ].join('\n');

    const matches = parseFixtures(html, 'basketball', 'https://www.betexplorer.com/next/basketball/?day=25&month=9&year=2026', '2026-09-25', { trustLeagueHeaders: true });
    expect(matches.length).toBe(1);
    expect(matches[0].homeTeam).toBe('Ancud');
    expect(matches[0].awayTeam).toBe('Puerto Montt');
    expect(matches[0].league).toContain('Chile');
    expect(matches[0].oddsText).toBe('1.56, 2.40');
    // data-dt 25,9,2026 00:00 WAT == UTC 24 Sep 23:00
    expect(new Date(matches[0].startTime).toISOString().slice(0, 16)).toBe('2026-09-24T23:00');
  });

  it('parses dash-interleaved span rows (volleyball next-page shape)', () => {
    const html = [
      '<tr class="js-tournament"><th><a href="/volleyball/world/pan-american-cup-final-six-women/" class="table-main__tournament"><i><img src="x" alt="World"></i>World: Pan-American Cup Final Six Women</a></th></tr>',
      '<tr data-dt="25,9,2026,23,00" data-def="0">',
      '<td class="table-main__tt"><span class="table-main__time">23:00</span><a href="/volleyball/world/pan-american-cup/dominican-republic-usa/hUO45nZ2/"><span>Dominican Republic W</span> - <span><strong>USA W</strong></span></a></td>',
      '<td class="table-main__odds"><button data-odd="2.05"></button></td>',
      '</tr>'
    ].join('\n');
    const matches = parseFixtures(html, 'volleyball', 'https://www.betexplorer.com/next/volleyball/?day=25&month=9&year=2026', '2026-09-25', { trustLeagueHeaders: true });
    expect(matches.length).toBe(1);
    expect(matches[0].homeTeam).toBe('Dominican Republic W');
    expect(matches[0].awayTeam).toBe('USA W');
  });

  it('rejects script/code fragments leaking from JS-heavy pages', () => {
    const text = [
      'var diff = now.getTime() - lastActiveTime1.getTime();',
      'document.querySelector(".table-main__time").innerHTML = "17:00";',
      'Rangers - Celtic 1.95 3.50 4.00',
      'Al Jazira - Al Ittihad 2.20 3.10 2.90'
    ].join('\n');
    const matches = parseFixtures(text, 'football', 'https://www.betexplorer.com/football/');
    expect(matches.length).toBe(2);
    expect(matches.some((m) => /var |getTime|querySelector|innerHTML/.test(m.homeTeam + ' ' + m.awayTeam))).toBe(false);
  });
});