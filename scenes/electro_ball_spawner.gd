extends Node2D

func electro_ball_spawner():
	var boss = get_node("/root/MainScene/BOSSdevil")
	var electro_ball = load("res://scenes/electro_ball.tscn")
	for i in range(2):
		var electro_ball_right = electro_ball.instantiate()
		electro_ball_right.position.x = boss.position.x + 120 + 80 * i 
		electro_ball_right.position.y = boss.position.y - 10
		if electro_ball_right.position.x > 650 and electro_ball_right.position.x < 1065:
			add_child(electro_ball_right)
		var electro_ball_left = electro_ball.instantiate()
		electro_ball_left.position.x = boss.position.x - 120 - 80 * i 
		electro_ball_left.position.y = boss.position.y - 10
		if electro_ball_left.position.x > 650 and electro_ball_right.position.x < 1065:
			add_child(electro_ball_left)
		
		await get_tree().create_timer(0.2).timeout
