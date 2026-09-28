extends HBoxContainer

@export var stats: Stats

@onready var health_bar: TextureProgressBar = $HealthBar


func _ready() -> void:
	stats.health_changed.connect(update_health)
	update_health()

func update_health() -> void:
	var percentage := stats.health / float(stats.max_health)
	health_bar.value = percentage
	
	
