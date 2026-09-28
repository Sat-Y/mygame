extends CanvasLayer

const AVATAR_MAP = {
	"player": preload("res://assets/Character5（剑盾骑士）/IDLE(1).png"),
	"npc1": preload("res://assets/死神/死神.png"),
}

@export var interval = 0.1

var dialogs = []
var current = 0

@onready var content: Label = $content
@onready var avatar: TextureRect = $content/Avatar
@onready var nextindicator: TextureRect = $content/Nextindicator

func _ready() -> void:
	hide_dialog_box()
	
	
func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_accept"):
		if current + 1 < dialogs.size():
			_show_dialog(current + 1)
		else:
			hide_dialog_box()
		get_tree()
	
func hide_dialog_box():
	content.hide()
	
func show_dialog_box(_dialogs):
	dialogs = _dialogs
	content.show()
	_show_dialog(0)
	
func _show_dialog(index):
	current = index
	var dialog = dialogs[current]
	content.text = dialog.text
	avatar.texture = AVATAR_MAP[dialog.avatar]
	
