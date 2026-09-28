extends CharacterBody2D

@onready var animation_player: AnimationPlayer = $AnimationPlayer

func _ready() -> void:
	animation_player.play("idel")
	
func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("interact"):
		DialogBox.show_dialog_box([
			{avatar="player", text="你是哪个？我怎么在这里"},
			{avatar="npc1", text="我是死神实习生，在这试炼之地冲业绩"},
			{avatar="npc1", text="比如像你这样的路边一条就是业绩"},
			{avatar="player", text="你说话真的很没礼貌"},
			{avatar="player", text="你大抵是要白跑一趟了"},
			{avatar="player", text="因为我肯定无伤速通"},
			{avatar="npc1", text="哈哈哈哈哈，拭目以待"},
		])
