import * as THREE from 'three';

import { FontLoader } from 'FontLoader';
import { TextGeometry } from 'TextGeometry';

THREE.Cache.enabled = true;
let container;
let camera, cameraTarget, scene, renderer;
let group, boxGroup;
let state = ''
let next_states = []
let font = undefined
const fontName = 'helvetiker'
const height = 10
const size = 26
const fontWeight = 'regular'
const size_x = 512;
const size_y = 512;
let prevTime = 0;
const pointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
let state_machine
let next_state_machine
let hovering = false
let interectedWith = -1
let selected = -1
let status = 'not_init'
const subs = []


export function set_next_state(next_state) {
    next_state_machine = next_state
}

export function subscribe(sub) {
    if (typeof sub !== 'function') throw new Error('sub must be a function')
    subs.push(sub)
}

export async function init() {

    container = document.createElement( 'div' );
    container.classList.add('container')
    document.body.appendChild( container );

    // CAMERA

    camera = new THREE.PerspectiveCamera( 30, size_x / size_y, 1, 1500 );
    camera.position.set( 0, 0, 700 );

    cameraTarget = new THREE.Vector3( 0, 0, 0 );

    // SCENE

    scene = new THREE.Scene();
    scene.background = null;

    boxGroup = new THREE.Group();
    scene.add( boxGroup );

    group = new THREE.Group();
    scene.add( group );

    await loadFont();

    // RENDERER

    renderer = new THREE.WebGLRenderer( { antialias: true } );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setClearColor( 0x000000, 0 ); // the default
    renderer.setSize( size_x, size_y );
    container.appendChild( renderer.domElement );

    // EVENTS

    container.style.touchAction = 'none';
    container.addEventListener( 'mouseenter', () => hovering = true );
    container.addEventListener( 'mousemove', onPointerMove );
    container.addEventListener( 'mouseleave', () => hovering = false );
    container.addEventListener( 'click', () => {
        if (selected === -1 && interectedWith !== -1) {
            selected = interectedWith
            interectedWith = -1
            if (container.classList.contains('hover'))
                container.classList.remove('hover')
        }
    });

    status = 'init'

    prevTime = performance.now();
    animate(prevTime);
}

function loadFont() {
    return new Promise((resolve) => {
        const loader = new FontLoader();
        loader.load( fontName + '_' + fontWeight + '.typeface.json', function ( response ) {

            font = response;

            resolve()

        } );
    })
}

/*

*/

function createText() {

    const [options, nexts] = Object.entries(state_machine[state]).reduce((acc, [key, value]) => {
        acc[0].push(key)
        acc[1].push(value)
        return acc
    }, [[], []])
    next_states = nexts
    for (let i = 0; i < options.length; i += 1)
    {
        /*
        - first, create a threejs 'box' for each option
        - this box will contain each character
        - the box will resize to fit the text
        - the box will be centered on the screen
        - the box will be offset by its index in the options array
        */
        const optionGroup = new THREE.Group()
        
        const pad = 40
        const sz_h = 180
        const sz = ((sz_h * 2) - pad) / options.length
        optionGroup.position.y = sz_h - (pad + (sz * i + sz * 0.5) - (height * 0.5))

        

        const str = options[i].split('')
        let total_width = 0
        const charMeshes = []
        for (let j = 0; j < str.length; j += 1)
        {
            const text = str[j] === ' ' ? '_' : str[j];
            const textGeo = new TextGeometry( text, {
                font: font,
                size: size,
                height: height,
            } );

            textGeo.computeBoundingBox();

            const charMesh = new THREE.Mesh( textGeo, [
                new THREE.MeshBasicMaterial( { color: 0xffffff } ), // front
                new THREE.MeshBasicMaterial( { color: 0x29B1E2 } ) // side
            ] );

            if (text === '_') charMesh.visible = false
            charMeshes.push(charMesh)
            optionGroup.add( charMesh );
            charMesh.position.x = total_width
            charMesh.position.y = 0
            total_width += textGeo.boundingBox.max.x - textGeo.boundingBox.min.x + 5
        }

        // Calculate bounding box of the group
        const boundingBox = new THREE.Box3().setFromObject(optionGroup);

        // Create hit box
        const hitBoxSize = boundingBox.getSize(new THREE.Vector3());
        const hitBoxCenter = boundingBox.getCenter(new THREE.Vector3());
        const hitBoxGeometry = new THREE.BoxGeometry(hitBoxSize.x, hitBoxSize.y, hitBoxSize.z);
        const hitBoxMaterial = new THREE.MeshBasicMaterial({ visible: false });
        const hitBox = new THREE.Mesh(hitBoxGeometry, hitBoxMaterial);
        hitBox.name = String(i)
        hitBox.position.copy(hitBoxCenter);

        hitBoxGeometry.computeBoundingBox();
        const xSize = hitBoxGeometry.boundingBox.max.x - hitBoxGeometry.boundingBox.min.x
        optionGroup.position.x = -xSize / 2
        hitBox.position.x = 0

        group.add( optionGroup );
        boxGroup.add(hitBox);
    }

    status = 'active'
}

function destoryText() {
    group.children.forEach((optionGroup) => {
        optionGroup.children.forEach((charMesh) => {
            charMesh.geometry.dispose()
            charMesh.material[0].dispose()
            charMesh.material[1].dispose()
        })
    })
    group.children = []
    boxGroup.children.forEach((hitBox) => {
        hitBox.geometry.dispose()
        hitBox.material.dispose()
    })
    boxGroup.children = []
}


function onPointerMove( event ) {
    const rect = event.target.getBoundingClientRect();
    pointer.x = ( (event.clientX - rect.left) / size_x ) * 2 - 1;
    pointer.y = - ( (event.clientY - rect.top) / size_y ) * 2 + 1;
}

function animate(time) {

    requestAnimationFrame( animate );

    handleIntersect()

    render(time);

}

function handleIntersect() {
    if (!hovering || selected > -1 || status !== 'active') return
    raycaster.setFromCamera( pointer, camera );

    const intersects = raycaster.intersectObjects( boxGroup.children, false );
    if ( intersects.length > 0 ) {
        interectedWith = parseInt(intersects[0].object.name)
        if (!container.classList.contains('hover'))
            container.classList.add('hover')
    } else {
        interectedWith = -1
        if (container.classList.contains('hover'))
            container.classList.remove('hover')
    }
}

function update_objects(time, delta) {
    let can_end = true
    for (let i = 0; i < group.children.length; i += 1)
    {
        for (let j = 0; j < group.children[i].children.length; j += 1)
        {
            const charMesh = group.children[i].children[j]
            if (!charMesh.visible) continue
            const rotation_x =
                Math.sin(time / ((j + 1.3) * 1000) + ((i + j)))
                * Math.cos(time / ((i + 1.1) * 1000) + ((i - j)))
                * 0.1
            const rotation_y =
                Math.sin(time / ((j + 1.2) * 1000) + ((i - j)))
                * Math.sin(time / ((i + 1.2) * 1000) + ((i + j)))
                * 0.1
            const rotation_z =
                Math.cos(time / ((j + 1.1) * 1000) + ((i + j)))
                * Math.cos(time / ((i + 1.3) * 1000) + ((i - j)))
                * 0.1
            
            charMesh.rotation.set(rotation_x, rotation_y, rotation_z)


            if (selected === -1) {
                can_end = false
                if (i === interectedWith) {
                    charMesh.material[0].color.set(0xFAD7FF)
                } else {
                    charMesh.material[0].color.set(0xffffff)
                }
            } else {
                if (i !== selected) {
                    if (charMesh.position.y > -(256 + height + 100)) {
                        charMesh.position.y -= (Math.random() * 0.1 * 9.8 * delta)
                        can_end = false
                    }
                }
                charMesh.material[0].color.set(0xffffff)
            }
        }
        prevTime = time
    }
    if (can_end) {
        status = 'ready'
    }
}


function render(time)
{
    const delta = time - prevTime
    if ((status === 'init' || status === 'ready') && (next_state_machine || next_states.length)) {
        const do_emit = next_states.length && state_machine[next_states[selected]] === 'emit'
        if (do_emit) subs.forEach(sub => sub(next_states[selected]))
        if (next_state_machine) {
            state_machine = next_state_machine
            state = '000'
            next_state_machine = undefined
        } else if (!do_emit) {
            state = next_states[selected]
        } else {
            state = ''
        }
        next_states.length = 0
        selected = -1
        

        if (state && status === 'ready')
            destoryText()
        if (state)
            createText()
    }

    if (status === 'active' || status === 'ready') {
        update_objects(time, delta)
    }

    camera.lookAt( cameraTarget );

    renderer.clear();
    renderer.render( scene, camera );

}