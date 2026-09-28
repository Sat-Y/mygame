class_name Player
extends CharacterBody2D
#状态机

const JUMP_VELOCITY := -320.0
const RUN_SPEED := 200.0
const FLOOR_ACCELERATE := RUN_SPEED/0.2  #物理学，v=at，所以a=v/t
const GROUND_STATE := [State.IDLE, State.RUNNING, State.ATTACK1, State.ATTACK2, State.ATTACK3, State.DEFEND ,State.SHANBI]
const KNOCKBACK_AMOUNT = 200.0
const SHANBI_SPEED = -450.0
const SHANBI_ENERGY = 3.6

var default_gravity := ProjectSettings.get("physics/2d/default_gravity") as float
var is_first_tick := false
var is_combo_requested := false
var pending_damage: Damage
var interacting_with: Array[Interactable]

enum Direction {
	LEFT = -1,
	RIGHT = 1,
}

enum State {
	IDLE,
	RUNNING,
	JUMP,
	FALL,
	ATTACK1,
	ATTACK2,
	ATTACK3,
	HURT,
	DIE,
	DEFEND,
	SHANBI,
}

@export var can_combo := false
@export var direction := Direction.RIGHT:
	set(v):
		direction = v
		if not is_node_ready():
			await ready
		graphics.scale.x = direction

@onready var sprite_2d: Sprite2D = $Sprite2D
@onready var animation_player: AnimationPlayer = $AnimationPlayer
@onready var coyote_timer: Timer = $CoyoteTimer
@onready var jump_request_timer: Timer = $JumpRequestTimer
@onready var atteck_request_timer: Timer = $AtteckRequestTimer
@onready var invincible_timer: Timer = $InvincibleTimer
@onready var stats: Node = Game.player_stats
@onready var state_machine: StateMachine = $StateMachine
@onready var player: CharacterBody2D = $"."
@onready var defend_request_timer: Timer = $DefendRequestTimer
@onready var shanbi_request_timer: Timer = $ShanbiRequestTimer
@onready var interaction_icon: AnimatedSprite2D = $InteractionIcon
@onready var graphics: Node2D = $Graphics
@onready var game_over_screen: Control = $CanvasLayer/GameOverScreen


func _ready() -> void:
	if stats:
		stats.health = stats.max_health  # 假设Stats类有max_health属性
	stand(default_gravity, 0.01)

func tick_physics(state: State, delta: float) -> void:
	#主要写每一帧必须要做的事情
	interaction_icon.visible = not interacting_with.is_empty()
	
	if invincible_timer.time_left > 0:
		player.modulate.a = sin(Time.get_ticks_msec() / 20) * 0.5 + 0.5
	else:
		player.modulate.a = 1
	
	match state:
		State.IDLE:
			move(default_gravity, delta)
			
		State.RUNNING:
			move(default_gravity, delta)
			
		State.JUMP:
			move(0.0 if  is_first_tick else default_gravity, delta)
		
		State.FALL:
			move(default_gravity, delta)
			
		State.ATTACK1:
			stand(default_gravity, delta)
			
		State.ATTACK2:
			stand(default_gravity, delta)
			
		State.ATTACK3:
			stand(default_gravity, delta)
			
		State.DIE:
			stand(default_gravity, delta)
			
		State.HURT:
			stand(default_gravity, delta)
			
		State.DEFEND:
			stand(default_gravity, delta)
			
		State.SHANBI:
			move(default_gravity, delta)
	
	is_first_tick = false



func get_next_state(state: State) -> int:
	#主要写转换到下一个场景的前置条件
	if stats.health == 0:
		return StateMachine.KEEP_CURRENT if state == State.DIE else State.DIE
		
	if pending_damage:
		return State.HURT
	
	var movement := Input.get_axis("move_left", "move_right")
	#接收键盘信号保存到direction变量
	#向左移动对应1 向右移动对应-1 不按对应0
	var is_still := is_zero_approx(movement) and is_zero_approx(velocity.x)
	#表示玩家是否站立不动
	var can_jump := is_on_floor() or coyote_timer.time_left > 0
	var should_jump := can_jump and jump_request_timer.time_left > 0
	if should_jump:
		return State.JUMP
		
	if state in GROUND_STATE and not is_on_floor():
		return State.FALL
	
	match state:
		State.IDLE:
			if Input.is_action_just_pressed("attack"):
				return State.ATTACK1
			if Input.is_action_just_pressed("defend"):
				return State.DEFEND
			if Input.is_action_just_pressed("闪避") and stats.energy >= SHANBI_ENERGY:
				return State.SHANBI
			if not is_still:
				return State.RUNNING
			
		State.RUNNING:
			if Input.is_action_just_pressed("attack"):
				return State.ATTACK1
			if Input.is_action_just_pressed("defend"):
				return State.DEFEND
			if Input.is_action_just_pressed("闪避") and stats.energy >= SHANBI_ENERGY:
				return State.SHANBI
			if is_still:
				return State.IDLE
			
		State.JUMP:
			if Input.is_action_just_pressed("闪避") and stats.energy >= SHANBI_ENERGY:
				return State.SHANBI
			if velocity.y >= 0:
				return State.FALL
		
		State.FALL:
			if is_on_floor():
				return State.IDLE if is_still else State.RUNNING
			
		State.ATTACK1:
			if not animation_player.is_playing():
				return State.ATTACK2 if is_combo_requested else State.IDLE
			
		State.ATTACK2:
			if not animation_player.is_playing():
				return State.ATTACK3 if is_combo_requested else State.IDLE
			
		State.ATTACK3:
			if not animation_player.is_playing():
				return State.IDLE
			
		State.SHANBI:
			if not animation_player.is_playing():
				return State.IDLE
			
		State.HURT:
			if not animation_player.is_playing():
				return State.IDLE
			
		State.DEFEND:
			if not animation_player.is_playing():
				return State.IDLE 
			
	return StateMachine.KEEP_CURRENT
	
	
func transition_state(from: State, to: State) -> void:
	#from表示从哪个状态退出  to表示要到哪个状态
	#主要写从from到to这个过程需要做什么
	if from not in GROUND_STATE and to in GROUND_STATE:
		coyote_timer.stop()
	
	match to:
		State.IDLE:
			animation_player.play("idle")
			#animation_player.play()播放动画
		
		State.RUNNING:
			animation_player.play("run")
			
		State.JUMP:
			animation_player.play("jump")
			velocity.y = JUMP_VELOCITY
			coyote_timer.stop()
			jump_request_timer.stop()
		
		State.FALL:
			animation_player.play("fall")
			if from in GROUND_STATE:
				coyote_timer.start()
			
		State.ATTACK1:
			animation_player.play("attack1")
			atteck_request_timer.stop()
			is_combo_requested = false
			
		State.ATTACK2:
			animation_player.play("attack2")
			is_combo_requested = false
			
		State.ATTACK3:
			animation_player.play("attack3")
			is_combo_requested = false
			
		State.DIE:
			animation_player.play("die")
			invincible_timer.stop()
			
		State.HURT:
			animation_player.play("hurt")
			Game.shake_camera(4)
			
			stats.health -= pending_damage.amount
			print("可恶")
			
			var dir := pending_damage.source.global_position.direction_to(global_position)
			velocity = dir * KNOCKBACK_AMOUNT
				
			pending_damage = null
			invincible_timer.start()
			
		State.DEFEND:
			animation_player.play("defend")
			defend_request_timer.stop()
			
		State.SHANBI:
			animation_player.play("run_2")
			stats.energy -= SHANBI_ENERGY
			if not is_on_floor():
				if graphics.scale.x < 0:
					velocity.x = -580
				else:
					velocity.x = 580
			else:
				if graphics.scale.x < 0:
					velocity.x = -450
				else:
					velocity.x = 450
				#以上是第一代思考的闪避版本
			shanbi_request_timer.stop()
			

	is_first_tick = true


func move(gravity: float, delta: float) -> void:
	var movement := Input.get_axis("move_left", "move_right")
	var acceleration := FLOOR_ACCELERATE 
	velocity.x = move_toward(velocity.x, movement * RUN_SPEED, acceleration * delta)
	velocity.y += gravity * delta
	#delta这里表示时间差
	
	if not is_zero_approx(movement):
		direction = Direction.LEFT if movement < 0 else Direction.RIGHT
		
	move_and_slide()
	
#func shanbi(gravity: float, delta: float) -> void:
	#velocity.x = player.scale.x * SHANBI_SPEED
	#velocity.y += gravity * delta
		#
	#move_and_slide()
	#闪避实现版本2，失败，后续再想
	
	
func stand(gravity: float, delta: float) -> void:
	var acceleration := FLOOR_ACCELERATE
	velocity.x = move_toward(velocity.x, 0.0,acceleration * delta)
	velocity.y += gravity * delta
	
	move_and_slide()
	
func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("interact") and interacting_with:
		interacting_with.back().interact()
	
	if event.is_action_pressed("jump"):
		jump_request_timer.start()
	
	if event.is_action_pressed("attack") and can_combo:
		is_combo_requested = true
	
	if event.is_action_pressed("attack"):
		atteck_request_timer.start()
		
	if event.is_action_pressed("闪避") and stats.energy >= SHANBI_ENERGY:
		shanbi_request_timer.start()
	
	if event.is_action_pressed("defend"):
		defend_request_timer.start()
		
func die() -> void:
	game_over_screen.show_game_over()
	
func register_interactable(v: Interactable) -> void:
	if state_machine.current_state == State.DIE:
		return
	if v in interacting_with:
		return
	interacting_with.append(v)
	
func unregister_interactable(v: Interactable) -> void:
	interacting_with.erase(v)
		
func _on_hurtbox_hurt(hitbox: Hitbox) -> void:
	if invincible_timer.time_left > 0:
		return 
	pending_damage = Damage.new()
	pending_damage.amount = 1
	pending_damage.source = hitbox.owner


func _on_hitbox_hit(hurtbox: Variant) -> void:
	Game.shake_camera(2)
	
	Engine.time_scale = 0.01
	await get_tree().create_timer(0.03, true, false, true).timeout
	Engine.time_scale = 1
