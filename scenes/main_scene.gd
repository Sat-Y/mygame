class_name World
extends Node2D

@onready var camera_2d: Camera2D = $Player/Camera2D
@onready var tile_map_layer: TileMapLayer = $TileMapLayer
@onready var player: Player = $Player

func _ready() -> void:
	pass

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		Game.back_to_title()

	
func update_player(pos: Vector2, direction: Player.Direction) -> void:
	player.global_position = pos
	player.direction = direction
	camera_2d.reset_smoothing()
	camera_2d.force_update_scroll()
	

func to_dict() -> Dictionary:
	var enemies_alive := []
	for node in get_tree().get_nodes_in_group("enemies"):
		var path := get_path_to(node) as String
		enemies_alive.append(path)
		
	return {
		enemies_alive = enemies_alive,
	}
	
func from_dict(dict: Dictionary) -> void:
	for node in get_tree().get_nodes_in_group("enemies"):
		var path := get_path_to(node) as String
		if path not in dict.enemies_alive:
			node.queue_free()
