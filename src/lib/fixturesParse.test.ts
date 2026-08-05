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

  it('parses plain "TeamA vs TeamB" lines', () => {
    const text = 'Villarreal - Levante\nAustria Vienna W - Hajduk Split W';
    const matches = parseFixtures(text, 'football', 'https://www.betexplorer.com/football/');
    expect(matches.length).toBe(2);
    expect(matches[0].homeTeam).toContain('Villarreal');
  });
});