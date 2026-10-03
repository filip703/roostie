import test from 'node:test'
import assert from 'node:assert/strict'
import { lankifiera } from '../src/ui/lanka.js'

test('https-adress blir länk med _blank och noopener, skiljetecken står utanför', () => {
  const h = lankifiera('Se https://roost.love/admin/loggbok?rad=5, sen mer')
  assert.match(h, /<a class="lank" href="https:\/\/roost\.love\/admin\/loggbok\?rad=5" target="_blank" rel="noopener">/)
  assert.ok(h.includes('</a>, sen mer'))
})

test('roost.love utan https får https', () => {
  assert.match(lankifiera('roost.love/admin'), /href="https:\/\/roost\.love\/admin"/)
})

test('Rad N blir länk till tavlan', () => {
  assert.match(lankifiera('Rad 2457: x'), /href="https:\/\/roost\.love\/admin\/loggbok\?rad=2457"[^>]*>Rad 2457<\/a>: x/)
})

test('bildbanksadress får data-bild', () => {
  assert.match(lankifiera('https://roost.love/api/bildbank/abc.png'), /data-bild="1"/)
  assert.doesNotMatch(lankifiera('https://example.com/sida'), /data-bild/)
})

test('övrig text escapas', () => {
  const h = lankifiera('<img src=x onerror=1> & "q"')
  assert.ok(!h.includes('<img'))
  assert.ok(h.includes('&lt;img') && h.includes('&amp;') && h.includes('&quot;q&quot;'))
})

test('tom eller saknad text', () => {
  assert.equal(lankifiera(null), '')
  assert.equal(lankifiera(''), '')
})

test('bart https:// utan värd blir ingen länk', () => {
  assert.doesNotMatch(lankifiera('alla URL:er — https://, roost.love/x'), /href="https:\/\/"/)
  assert.match(lankifiera('alla URL:er — https://, roost.love/x'), /href="https:\/\/roost\.love\/x"/)
})
