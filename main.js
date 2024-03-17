import {set_next_state, subscribe, init} from 'ui'


export async function main() {
    const {state_machine, value_map} = await fetch('./llm_machine.json')
        .then(response => response.json())
    let reload = false
    subscribe((state) => {
        if (reload) {
            set_next_state(state_machine)
            reload = false
        } else {
            set_next_state({
                "000": {
                  [value_map[state]]: "001",
                },
                "001": "emit",
            })
            reload = true
        }
    })
    init()
    set_next_state(state_machine)
}