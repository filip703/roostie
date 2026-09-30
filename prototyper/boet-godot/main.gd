extends Node2D

# Boet Godot-prov — kolonin motorprov
# Replikerar boet-rive-pixi.html: gren, bo (horisontella kvistlager),
# fjädrar, ägg och fågel. Håll-in → fjädrar flyger in → ägg kläcks → fågel.

# ── Palett ────────────────────────────────────────────
const C_BG         := Color(0.047, 0.094, 0.188)
const C_BRANCH     := Color(0.165, 0.267, 0.208)
const C_BRANCH_HL  := Color(0.239, 0.400, 0.314)
const C_NEST_DARK  := Color(0.290, 0.180, 0.094)
const C_NEST_MID   := Color(0.541, 0.400, 0.251)
const C_NEST_LIGHT := Color(0.769, 0.651, 0.471)
const C_NEST_RIM   := Color(0.843, 0.659, 0.373)
const C_F_CLAY     := Color(0.788, 0.471, 0.369)
const C_F_CAMEL    := Color(0.769, 0.651, 0.471)
const C_F_HONEY    := Color(0.843, 0.659, 0.373)
const C_F_FOREST   := Color(0.208, 0.345, 0.290)
const C_EGG_SHELL  := Color(0.929, 0.878, 0.769)
const C_EGG_SPOT   := Color(0.769, 0.651, 0.471)
const C_EGG_CRACK  := Color(0.478, 0.345, 0.188)
const C_GLOW       := Color(1.000, 0.910, 0.690)
const C_BIRD_BODY  := Color(0.843, 0.659, 0.373)
const C_BIRD_WING  := Color(0.788, 0.471, 0.369)
const C_BIRD_BEAK  := Color(0.910, 0.627, 0.376)
const C_CREAM      := Color(0.957, 0.929, 0.882)
const C_DIMMED     := Color(0.604, 0.655, 0.612)

var FEATHER_COLS: Array[Color] = []

# ── Scen-konstanter ───────────────────────────────────
# NX/NY = boets centrum i canvas-koordinater.
# NR = boets radie — styr all proportionell skalning.
# Rad 1361 fix: NR 62→316 (×5.1), NX centrerat, NY ≈44 % från toppen.
# Resultat: boet fyller ≈65 % av canvas-bredden (krav: ≥65 %).
const NX: float = 512.0
const NY: float = 440.0
const NR: float = 316.0
# Linjebredd-skalfaktor (NR/62 * 0.45) — samma formel som Pixi-provet
const SC_L: float = NR / 62.0 * 0.45
const NEST_PROGRESS: float = 0.75
const BASE_W: float = 1024.0
const BASE_H: float = 768.0

# ── Typed tillstånd ───────────────────────────────────
var st_fjadrar: int = 3
var st_max_fjadrar: int = 9
var st_agg_klackt: bool = false
var st_agg_crack: float = 0.0
var st_agg_wobble: float = 0.0
var st_fagel_vis: bool = false
var st_fagel_scale: float = 0.0
var st_fagel_face_left: bool = false
var st_fagel_hop_t: float = 0.0
var st_halls_in: bool = false
var st_last_fjader_tid: float = 0.0
var st_fj_saldo: int = 7
var st_flying_fjadrar: Array[Dictionary] = []

var nest_fjadrar: Array[Dictionary] = []

# UI nodes
var lbl_niva: Label
var lbl_saldo: Label
var lbl_klackt: Label
var btn_hall: Button
var lbl_motor: Label
var lbl_fps: Label

var elapsed: float = 0.0
var fps_timer: float = 0.0
var frame_count: int = 0
var klackt_fade_start: float = -1.0

func _ready() -> void:
	FEATHER_COLS = [C_F_CLAY, C_F_CAMEL, C_F_HONEY, C_F_FOREST]

	# Fjäderpositioner skalade ×5.1 från original (NR 62→316).
	nest_fjadrar = [
		{"tx": NX - 102, "ty": NY + 31,  "angle": -0.45, "col": 0, "len": 112.0},
		{"tx": NX + 61,  "ty": NY + 10,  "angle":  0.32, "col": 2, "len": 97.0},
		{"tx": NX - 31,  "ty": NY - 41,  "angle": -0.12, "col": 1, "len": 122.0},
		{"tx": NX + 122, "ty": NY + 71,  "angle":  0.58, "col": 3, "len": 87.0},
		{"tx": NX - 71,  "ty": NY + 82,  "angle": -0.28, "col": 2, "len": 102.0},
		{"tx": NX + 20,  "ty": NY - 71,  "angle":  0.19, "col": 0, "len": 92.0},
		{"tx": NX - 143, "ty": NY - 20,  "angle": -0.6,  "col": 1, "len": 107.0},
		{"tx": NX + 153, "ty": NY + 20,  "angle":  0.44, "col": 3, "len": 82.0},
		{"tx": NX - 20,  "ty": NY + 61,  "angle": -0.05, "col": 2, "len": 117.0},
	]

	RenderingServer.set_default_clear_color(C_BG)

	lbl_niva = Label.new()
	lbl_niva.text = "Nivå 3"
	lbl_niva.position = Vector2(20, 16)
	lbl_niva.add_theme_color_override("font_color", C_CREAM)
	lbl_niva.add_theme_font_size_override("font_size", 20)
	add_child(lbl_niva)

	lbl_saldo = Label.new()
	lbl_saldo.text = "7 fjädrar"
	lbl_saldo.position = Vector2(BASE_W - 130, 22)
	lbl_saldo.add_theme_color_override("font_color", C_NEST_RIM)
	lbl_saldo.add_theme_font_size_override("font_size", 15)
	add_child(lbl_saldo)

	lbl_klackt = Label.new()
	lbl_klackt.text = "Kläckt!"
	lbl_klackt.position = Vector2(NX - 80, 80)
	lbl_klackt.add_theme_color_override("font_color", C_NEST_RIM)
	lbl_klackt.add_theme_font_size_override("font_size", 38)
	lbl_klackt.modulate.a = 0.0
	add_child(lbl_klackt)

	btn_hall = Button.new()
	btn_hall.text = "Håll in"
	btn_hall.position = Vector2(BASE_W / 2 - 80, BASE_H - 100)
	btn_hall.size = Vector2(160, 52)
	btn_hall.connect("button_down", _on_hall_down)
	btn_hall.connect("button_up", _on_hall_up)
	add_child(btn_hall)

	lbl_motor = Label.new()
	lbl_motor.text = "kolonin · motorprov Godot 4 · rad 1361"
	lbl_motor.position = Vector2(BASE_W / 2 - 180, BASE_H - 20)
	lbl_motor.add_theme_color_override("font_color", Color(0.6, 0.65, 0.61, 0.6))
	lbl_motor.add_theme_font_size_override("font_size", 11)
	add_child(lbl_motor)

	lbl_fps = Label.new()
	lbl_fps.text = "-- fps"
	lbl_fps.position = Vector2(BASE_W - 80, 8)
	lbl_fps.add_theme_color_override("font_color", C_DIMMED)
	lbl_fps.add_theme_font_size_override("font_size", 11)
	add_child(lbl_fps)

func _on_hall_down() -> void:
	if not st_agg_klackt:
		st_halls_in = true

func _on_hall_up() -> void:
	st_halls_in = false

func _input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		var mbe := event as InputEventMouseButton
		if mbe.pressed:
			var pos := mbe.position
			var dx := pos.x - NX
			var dy := pos.y - (NY - NR * 0.355)
			if dx * dx + dy * dy < (NR * 0.65) * (NR * 0.65) and not st_agg_klackt:
				st_agg_wobble = 18.0
			if st_fagel_vis:
				var bx := pos.x - NX
				var by_ := pos.y - (NY - NR * 0.355)
				if bx * bx + by_ * by_ < (NR * 0.78) * (NR * 0.78):
					st_fagel_hop_t = 0.01

func _process(delta: float) -> void:
	elapsed += delta
	frame_count += 1
	fps_timer += delta
	if fps_timer >= 1.0:
		lbl_fps.text = "%d fps" % roundi(float(frame_count) / fps_timer)
		frame_count = 0
		fps_timer = 0.0

	if st_halls_in and not st_agg_klackt:
		if elapsed - st_last_fjader_tid > 1.2 and st_fjadrar < st_max_fjadrar and st_fj_saldo > 0:
			_add_flying_fjader()
			st_last_fjader_tid = elapsed

	for i: int in range(st_flying_fjadrar.size() - 1, -1, -1):
		var f: Dictionary = st_flying_fjadrar[i]
		var ft: float = float(f["t"]) + delta * 1.4
		ft = minf(ft, 1.0)
		f["t"] = ft
		var fe: float = _ease_out_cubic(ft)
		f["cx"] = float(f["sx"]) + (float(f["tx"]) - float(f["sx"])) * fe
		f["cy"] = float(f["sy"]) + (float(f["ty"]) - float(f["sy"])) * fe
		f["angle"] = float(f["target_angle"]) * fe
		f["alpha"] = fe
		if ft >= 1.0:
			st_flying_fjadrar.remove_at(i)

	if st_agg_wobble > 0.5:
		st_agg_wobble *= 0.88

	if st_agg_klackt and st_agg_crack < 1.0:
		st_agg_crack = minf(st_agg_crack + delta * 0.4, 1.0)
		if st_agg_crack >= 1.0 and not st_fagel_vis:
			st_fagel_vis = true
			lbl_klackt.modulate.a = 1.0
			klackt_fade_start = elapsed + 1.4

	if klackt_fade_start > 0 and elapsed > klackt_fade_start:
		lbl_klackt.modulate.a = maxf(0.0, lbl_klackt.modulate.a - delta * 0.6)

	if st_fagel_vis:
		st_fagel_scale = minf(st_fagel_scale + delta * 1.2, 1.0)
		if st_fagel_hop_t > 0:
			st_fagel_hop_t = minf(st_fagel_hop_t + delta * 4.0, 1.0)
			if st_fagel_hop_t >= 1.0:
				st_fagel_hop_t = 0.0
		st_fagel_face_left = sin(elapsed * 0.004) > 0.0
		if st_fjadrar >= st_max_fjadrar:
			lbl_niva.text = "Nivå 4"

	queue_redraw()

func _draw() -> void:
	_draw_branch()
	_draw_nest(NEST_PROGRESS)
	_draw_nest_fjadrar()
	_draw_flying_fjadrar()
	if not st_agg_klackt or st_agg_crack < 1.0:
		_draw_agg()
	if st_fagel_vis:
		_draw_fagel()

# ── Rita gren ─────────────────────────────────────────
func _draw_branch() -> void:
	# Grenen sträcker sig över hela canvas-bredden, sitter under boets centrum.
	var branch_y: float = NY + NR * 0.46
	var pts := PackedVector2Array()
	for i: int in range(60):
		var t := float(i) / 59.0
		pts.append(_bezier(
			Vector2(0, branch_y + 4),
			Vector2(256, branch_y + 10),
			Vector2(512, branch_y - 4),
			Vector2(1024, branch_y + 1),
			t))
	draw_polyline(pts, Color(0, 0, 0, 0.4), 164.0, true)
	draw_polyline(pts, C_BRANCH, 133.0, true)
	draw_polyline(pts, Color(C_BRANCH_HL, 0.4), 41.0, true)

# ── Pseudo-rng ────────────────────────────────────────
func _mk_rng(seed_val: int) -> Array[int]:
	var s: Array[int] = [(seed_val | 0) + 1]
	return s

func _rng_next(state_arr: Array[int]) -> float:
	state_arr[0] = (state_arr[0] * 1664525 + 1013904223) & 0x7FFFFFFF
	return float(state_arr[0]) / float(0x7FFFFFFF)

# ── Rita bo — horisontella kvistlager ─────────────────
func _draw_nest(progress: float) -> void:
	var rng := _mk_rng(17)

	_draw_ellipse_fill(Vector2(NX + 6, NY + NR * 0.34 + 12),
		NR * 1.52 * progress, NR * 0.38 * progress,
		Color(0.020, 0.031, 0.031, 0.32 * progress))

	var LAYERS: int = 7
	for layer: int in range(LAYERS):
		if float(layer + 1) / float(LAYERS) > progress * 1.25:
			break
		var y_frac: float = float(layer) / float(LAYERS - 1)
		var y_off: float = NR * 0.28 - y_frac * NR * 0.50
		var x_half: float = NR * (1.06 - y_frac * 0.06)
		var n_twigs: int = 5 + layer
		for _t: int in range(n_twigs):
			var x_s: float = NX - x_half - _rng_next(rng) * NR * 0.32 + _rng_next(rng) * NR * 0.08
			var x_e: float = NX + x_half + _rng_next(rng) * NR * 0.08 - _rng_next(rng) * NR * 0.32
			var y_b: float = NY + y_off + (_rng_next(rng) - 0.5) * 26.0
			var cp_x: float = NX + (_rng_next(rng) - 0.5) * NR * 0.45
			var cp_y: float = y_b - NR * (0.04 + _rng_next(rng) * 0.10)
			var ri: int = int(_rng_next(rng) * 3)
			var col: Color
			if layer < 3:
				col = [C_NEST_DARK, C_NEST_DARK, C_NEST_MID][ri]
			else:
				col = [C_NEST_MID, C_NEST_LIGHT, C_NEST_RIM][ri]
			col.a = 0.42 + _rng_next(rng) * 0.46
			var width: float = (1.1 + _rng_next(rng) * 2.4) * SC_L
			var y1: float = y_b + (_rng_next(rng) - 0.5) * 5
			var y2: float = y_b + (_rng_next(rng) - 0.5) * 5
			var pts := _quadratic_pts(Vector2(x_s, y1), Vector2(cp_x, cp_y), Vector2(x_e, y2))
			draw_polyline(pts, col, width, true)

	_draw_ellipse_fill(Vector2(NX, NY + 4),
		NR * 0.67 * progress, NR * 0.30 * progress,
		Color(0.051, 0.024, 0.016, 0.82 * progress))

	var rng2 := _mk_rng(17)
	for _dummy: int in range(12):
		_rng_next(rng2)
	for _i: int in range(int(ceil(9.0 * progress))):
		var ang2: float = PI * (0.85 + _rng_next(rng2) * 0.30)
		var dist: float = NR * (0.18 + _rng_next(rng2) * 0.38)
		var cx: float = NX + (_rng_next(rng2) - 0.5) * NR * 0.50
		var cy: float = NY + (_rng_next(rng2) - 0.5) * NR * 0.14
		var ri2: int = int(_rng_next(rng2) * 2)
		var col2: Color = [C_NEST_DARK, C_NEST_MID][ri2]
		col2.a = 0.28 + _rng_next(rng2) * 0.32
		var w2: float = (0.6 + _rng_next(rng2) * 1.2) * SC_L
		draw_line(Vector2(cx - cos(ang2) * dist, cy - sin(ang2) * dist * 0.30),
			Vector2(cx + cos(ang2) * dist, cy + sin(ang2) * dist * 0.30), col2, w2, true)

	var rim_pts := PackedVector2Array()
	for ri3: int in range(50):
		var ang3: float = PI * 1.07 + (PI * 1.93 - PI * 1.07) * float(ri3) / 49.0
		rim_pts.append(Vector2(NX + cos(ang3) * NR * progress, NY + 6 + sin(ang3) * NR * progress * 0.6))
	draw_polyline(rim_pts, Color(C_NEST_RIM, 0.70 * progress), 8.5 * progress * SC_L, true)

	var rng3 := _mk_rng(17)
	for _dummy3: int in range(30):
		_rng_next(rng3)
	for _mi: int in range(int(ceil(7.0 * progress))):
		var ang4: float = _rng_next(rng3) * PI * 2.0
		var r: float = NR * (0.44 + _rng_next(rng3) * 0.60)
		var rad: float = (1.8 + _rng_next(rng3) * 3.8) * 2.2
		draw_circle(Vector2(NX + cos(ang4) * r, NY + sin(ang4) * r * 0.37), rad,
			Color(0.290, 0.478, 0.314, 0.18 + _rng_next(rng3) * 0.28))

# ── Rita fjäder ──────────────────────────────────────
func _draw_feather(pos: Vector2, angle: float, col: Color, length: float, alpha: float) -> void:
	var rot := Transform2D(angle, pos)
	var shaft_col := Color(col, alpha)
	draw_line(rot * Vector2(0, -length * 0.52), rot * Vector2(0, length * 0.48), shaft_col, 1.5, true)
	var y: float = -length * 0.42
	while y < length * 0.38:
		var bw: float = maxf(0.0, (length * 0.3 - abs(y) * 0.5) * 0.6)
		if bw >= 0.5:
			var bb := Color(col, alpha)
			draw_line(rot * Vector2(0, y), rot * Vector2( bw, y - bw * 0.35), bb, 0.9, true)
			draw_line(rot * Vector2(0, y), rot * Vector2(-bw, y - bw * 0.35), bb, 0.9, true)
		y += 4.5

func _draw_nest_fjadrar() -> void:
	for i: int in range(st_fjadrar):
		var fp: Dictionary = nest_fjadrar[i]
		_draw_feather(Vector2(float(fp["tx"]), float(fp["ty"])),
			float(fp["angle"]), FEATHER_COLS[int(fp["col"])], float(fp["len"]), 1.0)

func _draw_flying_fjadrar() -> void:
	for f: Dictionary in st_flying_fjadrar:
		_draw_feather(Vector2(float(f["cx"]), float(f["cy"])),
			float(f["angle"]), FEATHER_COLS[int(f["col_idx"])], float(f["len"]), float(f["alpha"]))

# ── Rita ägg ─────────────────────────────────────────
func _draw_agg() -> void:
	var crack: float = st_agg_crack
	var wobble: float = 0.0
	if st_agg_wobble > 0.5:
		wobble = sin(elapsed * 25.0) * st_agg_wobble

	# Ägg-dimensioner NR-proportionella (rad 1361).
	var egg_rx: float = NR * 0.484
	var egg_ry: float = NR * 0.613
	var ex := Vector2(NX, NY - NR * 0.355)
	if crack > 0.3:
		var ga: float = (crack - 0.3) / 0.7 * 0.14
		draw_circle(ex, egg_ry * 2.4, Color(C_GLOW, ga))

	_draw_ellipse_fill(ex + Vector2(0, wobble * 1.5), egg_rx, egg_ry, C_EGG_SHELL)

	var rng := _mk_rng(42)
	for _i: int in range(10):
		var fx: float = (_rng_next(rng) - 0.5) * egg_rx * 2.0 * 1.5
		var fy: float = (_rng_next(rng) - 0.5) * egg_ry * 2.0 * 1.4
		if (fx / egg_rx) * (fx / egg_rx) + (fy / egg_ry) * (fy / egg_ry) < 0.85:
			draw_circle(Vector2(ex.x + fx, ex.y + fy), _rng_next(rng) * 6.4 + 1.8,
				Color(C_EGG_SPOT, 0.42))

	if crack > 0:
		var alpha2: float = minf(crack * 2.5, 1.0)
		var crack_col := Color(C_EGG_CRACK, alpha2)
		var ew: float = egg_rx
		var eh: float = egg_ry
		draw_line(Vector2(ex.x - ew * 0.35, ex.y), Vector2(ex.x - ew * 0.05, ex.y - eh * 0.2), crack_col, 2.0)
		draw_line(Vector2(ex.x - ew * 0.05, ex.y - eh * 0.2), Vector2(ex.x + ew * 0.18, ex.y + eh * 0.07), crack_col, 2.0)
		draw_line(Vector2(ex.x + ew * 0.18, ex.y + eh * 0.07), Vector2(ex.x + ew * 0.38, ex.y - eh * 0.14), crack_col, 2.0)
		if crack > 0.35:
			var glow_alpha: float = (crack - 0.35) / 0.65
			draw_line(Vector2(ex.x - ew * 0.35, ex.y), Vector2(ex.x - ew * 0.05, ex.y - eh * 0.2),
				Color(C_GLOW, glow_alpha), 3.5)

# ── Rita fågel ────────────────────────────────────────
func _draw_fagel() -> void:
	var eo: float = _ease_out_cubic(st_fagel_scale)
	var size: float = NR * 0.387 * eo
	var hop: float = 0.0
	if st_fagel_hop_t > 0:
		hop = sin(st_fagel_hop_t * PI) * -NR * 0.29
	var bob: float = sin(elapsed * 0.0085) * NR * 0.056
	var pos := Vector2(NX, NY - NR * 0.355 + bob + hop)
	var alpha: float = eo
	if size < 2.0:
		return

	var sc: float = -1.0 if st_fagel_face_left else 1.0

	_draw_ellipse_fill(pos, size * 0.68, size * 0.48, Color(C_BIRD_BODY, alpha))
	_draw_ellipse_fill(pos + Vector2(sc * size * 0.1, size * 0.09),
		size * 0.44, size * 0.24, Color(C_BIRD_WING, alpha))
	draw_circle(pos + Vector2(-sc * size * 0.5, -size * 0.2), size * 0.33, Color(C_BIRD_BODY, alpha))
	draw_circle(pos + Vector2(-sc * size * 0.56, -size * 0.29), size * 0.1, Color(0.11, 0.15, 0.13, alpha))
	draw_circle(pos + Vector2(-sc * size * 0.58, -size * 0.31), size * 0.04, Color(1, 1, 1, 0.85 * alpha))
	var beak := PackedVector2Array([
		pos + Vector2(-sc * size * 0.79, -size * 0.21),
		pos + Vector2(-sc * size * 1.0,  -size * 0.14),
		pos + Vector2(-sc * size * 0.79, -size * 0.07),
	])
	draw_colored_polygon(beak, Color(C_BIRD_BEAK, alpha))
	var tail := PackedVector2Array([
		pos + Vector2(sc * size * 0.6,  0),
		pos + Vector2(sc * size * 0.92, -size * 0.2),
		pos + Vector2(sc * size * 0.88,  size * 0.12),
	])
	draw_colored_polygon(tail, Color(C_BIRD_WING, alpha))

# ── Hjälpfunktioner ───────────────────────────────────
func _add_flying_fjader() -> void:
	if st_fjadrar >= st_max_fjadrar or st_fj_saldo <= 0:
		return
	var i: int = st_fjadrar
	var fp: Dictionary = nest_fjadrar[i]
	var sides: Array[Dictionary] = [
		{"sx": -60.0, "sy": NY - 80.0},
		{"sx": BASE_W + 60.0, "sy": NY - 120.0},
		{"sx": -60.0, "sy": NY + 60.0},
		{"sx": BASE_W + 60.0, "sy": NY - 20.0},
	]
	var from_: Dictionary = sides[i % 4]
	st_flying_fjadrar.append({
		"sx": float(from_["sx"]), "sy": float(from_["sy"]),
		"cx": float(from_["sx"]), "cy": float(from_["sy"]),
		"tx": float(fp["tx"]), "ty": float(fp["ty"]),
		"target_angle": float(fp["angle"]),
		"angle": 0.0,
		"col_idx": int(fp["col"]),
		"len": float(fp["len"]),
		"t": 0.0,
		"alpha": 0.0,
	})
	st_fjadrar += 1
	st_fj_saldo -= 1
	lbl_saldo.text = "%d fjädrar" % st_fj_saldo

	if st_fjadrar >= st_max_fjadrar:
		_start_klackning()

func _start_klackning() -> void:
	st_agg_klackt = true
	btn_hall.visible = false

func _ease_out_cubic(t: float) -> float:
	return 1.0 - pow(1.0 - t, 3.0)

func _bezier(p0: Vector2, p1: Vector2, p2: Vector2, p3: Vector2, t: float) -> Vector2:
	var mt: float = 1.0 - t
	return mt * mt * mt * p0 + 3.0 * mt * mt * t * p1 + 3.0 * mt * t * t * p2 + t * t * t * p3

func _quadratic_pts(p0: Vector2, ctrl: Vector2, p1: Vector2, n: int = 16) -> PackedVector2Array:
	var pts := PackedVector2Array()
	for i: int in range(n + 1):
		var t: float = float(i) / float(n)
		var mt: float = 1.0 - t
		pts.append(mt * mt * p0 + 2.0 * mt * t * ctrl + t * t * p1)
	return pts

func _draw_ellipse_fill(center: Vector2, rx: float, ry: float, color: Color, segments: int = 32) -> void:
	var pts := PackedVector2Array()
	for i: int in range(segments):
		var a: float = float(i) / float(segments) * TAU
		pts.append(center + Vector2(cos(a) * rx, sin(a) * ry))
	draw_colored_polygon(pts, color)
