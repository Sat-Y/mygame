class_name StateMachine
extends Node

const KEEP_CURRENT := -1

var state_time: float
var current_state: int = -1:
	#因为枚举从0开始，int = 0 和current_state = 0冲突所以简单起见改-1
	set(v):
		owner.transition_state(current_state, v)
		#owner指父节点，此处指Player，transition_state()需要在父节点即Player有定义，进而收到所传的值
		#transition_state()  状态转换的记录
		current_state = v

func _ready() -> void:
	await owner.ready
	#因为ready正常顺序是所有 子节点 ready然后 父节点 ready，但这里需要等父节点，所有await
	current_state = 0
	
func _physics_process(delta: float) -> void:
	while true:
		#写一个死循环，用于确定当前状态，确保有状态
		var next := owner.get_next_state(current_state) as int
		#把该状态返回保存为变量next 类型是int类型    get_next_state()同理需要在父节点定义
		#get_next_state()  到达下一个状态
		if next == KEEP_CURRENT:
			break
		current_state = next
		
	owner.tick_physics(current_state, delta)
	#tick_physics()也需要在父节点定义
	#tick_physics()  表示当前帧要做什么
		
	
