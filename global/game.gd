extends Node

signal camera_should_shake(amount: float)

const SAVE_PATH := "user://data.sav"

var world_stats := {}

@onready var color_rect: ColorRect = $ColorRect
@onready var player_stats: Stats = $PlayerStats
@onready var default_player_stats := player_stats.to_dict()

func _ready() -> void:
	color_rect.color.a = 0

func change_scene(path: String, params := {}) -> void:
	var tree := get_tree()
	
	var tween := create_tween()
	tween.tween_property(color_rect, "color:a", 1, 0.2)
	await tween.finished
	
	if tree.current_scene is World:
		var old_name := tree.current_scene.scene_file_path.get_file().get_basename()
		world_stats[old_name] =  tree.current_scene.to_dict()
	
	if "init" in params:
		params.init.call()
	
	tree.change_scene_to_file(path)
	await tree.tree_changed
	
	if tree.current_scene is World:
		var new_name := tree.current_scene.scene_file_path.get_file().get_basename()
		if new_name in world_stats:
			tree.current_scene.from_dict(world_stats[new_name])
		
		if "entry_point" in params:
			for node in tree.get_nodes_in_group("entry_points"):
				if node.name == params.entry_point:
					tree.current_scene.update_player(node.global_position, node.direction)
					break
				
		if "position" in params and "direction" in params:
			tree.current_scene.update_player(params.position, params.direction)
	
			
	tween = create_tween()
	tween.tween_property(color_rect, "color:a", 0, 0.2)
	
func save_game() -> void:
	var scene := get_tree().current_scene
	var scene_name := scene.scene_file_path.get_file().get_basename()
	world_stats[scene_name] = scene.to_dict()
	 
	var data := {
		world_stats = world_stats,
		stats = player_stats.to_dict(),
		scene = scene.scene_file_path,
		player = {
			direction = scene.player.direction,
			position = {
				x = scene.player.global_position.x,
				y = scene.player.global_position.y,
			},
		},
	}
	var json := JSON.stringify(data)
	var file := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if not file:
		return
	file.store_string(json)
	
	
func load_game() -> void:
	var file := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if not file:
		return
	var json := file.get_as_text()
	var data := JSON.parse_string(json) as Dictionary

	change_scene(data.scene, {
		direction = data.player.direction,
		position = Vector2(
			data.player.position.x,
			data.player.position.y
		),
		init = func ():
			world_stats = data.world_stats
			player_stats.from_dict(data.stats)
	})
	
func new_game() -> void:
	change_scene("res://scenes/main_scene.tscn", {
		init = func ():
			world_stats = {}
			player_stats.from_dict(default_player_stats)
	})
	
	
func back_to_title() -> void:
	change_scene("res://scenes/title_screen.tscn")
	
func has_save() -> bool:
	return FileAccess.file_exists(SAVE_PATH)
	
func shake_camera(amount: float) -> void:
	camera_should_shake.emit(amount)
	
