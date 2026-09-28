extends CharacterBody2D

const KNOCKBACK_AMOUNT := 100.0

var currentState := State.READY
var isStateNew := true
var default_gravity := ProjectSettings.get("physics/2d/default_gravity") as float
var pending_damage : Damage

enum State {
	READY,
	IDLE,
	RUNNING,
	ATTACK1ZHUNBEI,
	ATTACK1,
	ATTACK2ZHUNBEI,
	HURT,
	DIE,
}

@onready var animation_player: AnimationPlayer = $AnimationPlayer
@onready var sprite_2d: Sprite2D = $Sprite2D
@onready var collision_shape_2d: CollisionShape2D = $CollisionShape2D
@onready var hurtbox: Hurtbox = $Hurtbox
@onready var hitbox: Hitbox = $Hitbox
@onready var stats: Stats = $Stats

func _ready() -> void:
	add_to_group("enemies")
	# 连接stats的健康变化信号（如果有的话）
	if stats.has_signal("health_changed"):
		stats.health_changed.connect(_on_health_changed)

func _process(delta: float) -> void:
	# 优先处理死亡状态
	if stats.health <= 0 and currentState != State.DIE:
		call_deferred("change_state", State.DIE)
		return
	
	# 处理受伤状态
	if pending_damage and currentState != State.DIE and currentState != State.HURT:
		call_deferred("change_state", State.HURT)
		return
	
	match currentState:
		State.READY:
			process_ready(delta)
		State.IDLE:
			process_idle(delta)
		State.RUNNING:
			process_running(delta)
		State.ATTACK1ZHUNBEI:
			process_attcak1zhunbei(delta)
		State.ATTACK1:
			process_attack1(delta)
		State.ATTACK2ZHUNBEI:
			process_attcak2zhunbei(delta)
		State.HURT:
			process_hurt(delta)
		State.DIE:
			process_die(delta)
	isStateNew = false

func change_state(newState):
	# 如果已经死亡，不允许切换到其他状态
	if currentState == State.DIE:
		return
		
	currentState = newState
	isStateNew = true

func _on_health_changed():
	# 健康值变化时的处理
	if stats.health <= 0 and currentState != State.DIE:
		call_deferred("change_state", State.DIE)

func turn_direction():
	var playerPosition = get_node("/root/MainScene/Player").global_position
	sprite_2d.scale.x = 2.44 if playerPosition.x > global_position.x else -2.44
	collision_shape_2d.scale.x = 1 if playerPosition.x > global_position.x else -1
	hitbox.scale.x = 1 if playerPosition.x > global_position.x else -1
	hurtbox.scale.x = 1 if playerPosition.x > global_position.x else -1
#scale.x可以控制角色的翻转，可以控制角色的朝向


func process_ready(delta: float) -> void:
	turn_direction()
	var playerPosition = get_node("/root/MainScene/Player").global_position
	animation_player.play("idle")
	if playerPosition.x > 690:
		call_deferred("change_state", State.IDLE)


func process_idle(delta: float) -> void:
	turn_direction()
	var playerPosition = get_node("/root/MainScene/Player").global_position
	if isStateNew:
		velocity = Vector2.ZERO
		animation_player.play("idle")
	if not is_on_floor():
		velocity.y += default_gravity * delta
	move_and_slide()
	
	if abs(playerPosition.x - global_position.x) < 90:
		call_deferred("change_state", State.ATTACK1ZHUNBEI)
	else:
		if randf() > 0.4:
		#用随机数概率事件实现boss的攻击多样化
			call_deferred("change_state", State.RUNNING)
		else:
			call_deferred("change_state", State.ATTACK2ZHUNBEI)


func process_running(delta: float) -> void:
	turn_direction()
	var playerPosition = get_node("/root/MainScene/Player").global_position
	#获取玩家的坐标
	if isStateNew:
		if playerPosition.x > global_position.x:
			velocity.x = 120
		else:
			velocity.x = -120
		animation_player.play("run")
	if not is_on_floor():
		velocity.y += default_gravity * delta
	move_and_slide()
	if abs(playerPosition.x - global_position.x) < 90:
	#abs()绝对值函数，可以有效的表示攻击半径
		call_deferred("change_state", State.ATTACK1ZHUNBEI)


func process_attcak1zhunbei(delta: float) -> void:
	if isStateNew:
		velocity = Vector2.ZERO
		animation_player.play("attack1zhunbei")
	if not animation_player.is_playing():
		call_deferred("change_state", State.ATTACK1)


func process_attack1(delta: float) -> void:
	if isStateNew:
		if sprite_2d.scale.x > 2.44:
			velocity.x = 10
		else:
			velocity.x = -10
		#攻击朝向玩家，并攻击后向玩家位移10像素的距离
		animation_player.play("attack1")
	if not is_on_floor():
		velocity.y += default_gravity * delta
	move_and_slide()
	if not animation_player.is_playing():
		call_deferred("change_state", State.IDLE)


func process_attcak2zhunbei(delta: float) -> void:
	if isStateNew:
		velocity = Vector2.ZERO
		#默认双向量为0，保证在该状态时boss不移动
		animation_player.play("attack2zhunbei")
		
	if not animation_player.is_playing():
		var electro_ball_spawner = get_node("/root/MainScene/Electro_Ball_spawner")
		#获取电球的技能效果
		electro_ball_spawner.electro_ball_spawner()
		#调用电球控制器进行电球动画的播放
		call_deferred("change_state", State.IDLE)


func process_die(delta: float) -> void:
	if isStateNew:
		animation_player.play("die")
		# 禁用碰撞和伤害检测
		#collision_shape_2d.disabled = true
		#hurtbox.monitoring = false
		#hitbox.monitoring = false
		#因为这三行代码会导致boss死亡动画播放不出来
		
	# 死亡状态下不执行其他逻辑
	if not animation_player.is_playing():
		queue_free()#这个会将boss从场景中删除


func process_hurt(delta: float) -> void:
	if isStateNew:
		# 播放受击动画
		animation_player.play("hurt")
		
		# 应用伤害和击退
		if pending_damage:
			stats.health -= pending_damage.amount
			var dir := pending_damage.source.global_position.direction_to(global_position)
			velocity = dir * KNOCKBACK_AMOUNT
			pending_damage = null 
	
	# 应用重力
	if not is_on_floor():
		velocity.y += default_gravity * delta
	
	# 移动（包含击退效果）
	move_and_slide()#加了这个会使角色移动
	
	# 动画播放完成后回到IDLE状态，但如果血量<=0则进入死亡状态
	if not animation_player.is_playing():
		if stats.health <= 0:
			call_deferred("change_state", State.DIE)
		else:
			call_deferred("change_state", State.IDLE)


func _on_hurtbox_hurt(hitbox: Hitbox) -> void:
	# 如果已经死亡，不再接受伤害
	if currentState == State.DIE:
		return
		
	pending_damage = Damage.new()
	pending_damage.amount = 1
	pending_damage.source = hitbox.owner
