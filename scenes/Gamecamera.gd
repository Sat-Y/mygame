extends Camera2D

var playerPositon := Vector2.ZERO
var strength := 0.0

@export var recovery_speed := 16.0

func _ready() -> void:
	Game.camera_should_shake.connect(func (amount: float):
		strength += amount
	)
	global_position.x = 208
	global_position.x = 118
	
func match_player_position():
	var players = get_tree().get_nodes_in_group("player")
	if players.size() > 0:
		var player = players[0]
		playerPositon = player.global_position
		
func _process(delta: float) -> void:
	offset = Vector2(
		randf_range(-strength, strength),
		randf_range(-strength, strength)
	)
	strength = move_toward(strength, 0, recovery_speed * delta) 

	
	match_player_position()
	if playerPositon.x > 208 and playerPositon.x < 570:
		global_position.x = lerp(playerPositon.x, global_position.x, pow(2, -7 * delta))
	if playerPositon.x >570:
		global_position.x = lerp(816.0, global_position.x, pow(2, -7 * delta))
	if playerPositon.x < 208:
		global_position.x = lerp(208.0, global_position.x, pow(2, -7 * delta))
	if playerPositon.x > 816 and playerPositon.x < 1120:
		global_position.x = lerp(playerPositon.x, global_position.x, pow(2, -7 * delta))
		
		
	
