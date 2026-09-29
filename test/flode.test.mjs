/**
 * Flödets regler. Det som gör historiken läsbar är inte CSS utan de här fyra sakerna:
 * ett pass är EN händelse, radnumret är inte rubriken, dygnet syns, och riktningen är given.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { byggFlode, dagnamn, langd, slaIhopPass, utanRadnummer } from '../src/ui/flode.js'

const T = (h, m = 0) => new Date(2026, 8, 29, h, m).getTime()
const NU = T(12)

test('ett pass är EN händelse, inte två repliker', () => {
  const ut = slaIhopPass([
    { nar: T(7, 36), fas: 'borjar', rubrik: 'Tar rad 1442: modulregistret', text: '' },
    { nar: T(7, 38), fas: 'klart', rubrik: 'Rad 1445: modulregistret klart', text: 'gjort' },
  ])
  assert.equal(ut.length, 1, 'börjar + klart ska bli en rad i flödet')
  assert.equal(ut[0].fas, 'klart')
  assert.equal(ut[0].rubrik, 'Rad 1445: modulregistret klart', 'avslutet säger vad som BLEV gjort')
  assert.equal(langd(ut[0].start, ut[0].slut), '2 min')
})

test('ett börjar som ingen stängt pågår — och det ska synas', () => {
  const ut = slaIhopPass([{ nar: T(11, 50), fas: 'borjar', rubrik: 'Tar rad 9', text: '' }])
  assert.equal(ut[0].fas, 'pagar')
  assert.equal(langd(ut[0].start, ut[0].slut), '', 'något som pågår har ingen längd än')
})

test('radnumret lyfts ur rubriken, men bara när det är ett prefix', () => {
  assert.deepEqual(utanRadnummer('Rad 1445: Display 2.0 steg 1'), { text: 'Display 2.0 steg 1', rad: 1445 })
  assert.deepEqual(utanRadnummer('Tar rad 1442: modulregistret'), { text: 'modulregistret', rad: 1442 })
  const bar = utanRadnummer('Rad 1259 väntar på Filip')
  assert.equal(bar.text, 'Rad 1259 väntar på Filip', 'här bär numret meningen och ska stå kvar')
})

test('dygnet syns — annars är listan ingen tidslinje', () => {
  assert.equal(dagnamn(T(7), NU), 'I dag')
  assert.equal(dagnamn(T(7) - 86400000, NU), 'I går')
  assert.match(dagnamn(T(7) - 3 * 86400000, NU), /\d+ sep$/)
})

test('flödet är kronologiskt, har dagsavdelare och blandar in Filips svar', () => {
  const ut = byggFlode(
    [
      { nar: T(7) - 86400000, fas: 'klart', rubrik: 'Rad 1: i går', text: '' },
      { nar: T(8), fas: 'borjar', rubrik: 'Tar rad 2: i dag', text: '' },
      { nar: T(8, 20), fas: 'klart', rubrik: 'Rad 3: i dag klart', text: '' },
    ],
    [{ nar: T(9), rubrik: 'TILL PRODUKT: kör på', text: 'kör på' }],
    NU
  )
  const avdelare = ut.filter((x) => x.avdelare).map((x) => x.avdelare)
  assert.deepEqual(avdelare, ['I går', 'I dag'])
  const repliker = ut.filter((x) => !x.avdelare)
  assert.equal(repliker.length, 3, 'två händelser plus Filips svar')
  assert.equal(repliker[repliker.length - 1].min, true, 'hans svar är det senaste')
  for (let i = 1; i < repliker.length; i++) {
    assert.ok(repliker[i].nar >= repliker[i - 1].nar, 'äldst överst')
  }
})

test('passrader som bara är städning hamnar inte i samtalet', () => {
  const ut = byggFlode([{ nar: T(8), fas: 'notis', rubrik: 'kolonin-passet: inget att ta', text: '' }], [], NU)
  assert.equal(ut.filter((x) => !x.avdelare).length, 0)
})
