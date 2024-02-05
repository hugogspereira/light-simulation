import { loadShadersFromURLS, setupWebGL, buildProgramFromSources } from './libs/utils.js';
import { vec4, flatten, lookAt, normalMatrix, vec3, perspective, rotateY, rotateX, mult } from './libs/MV.js';
import { modelView, multScale, multTranslation, popMatrix, pushMatrix } from "./libs/stack.js";
import * as CUBE from './libs/cube.js';
import * as SPHERE from './libs/sphere.js';
import * as DAT from './libs/dat.gui.module.js';
import * as CYLINDER from './libs/cylinder.js';
import * as PYRAMID from './libs/pyramid.js';
import * as TORUS from './libs/torus.js';
import * as STACK from './libs/stack.js';

/**
 * Project done by: 58010 (Hugo Pereira) / 59187 (Bernardo Calvo)
 * 
 * EXTRAS: Button that adds a new light; Moving lights (turn them on or off in options); Scroll mouse for zoom in or out
 */


/** @type {WebGLRenderingContext} */
let gl;
let mode;
let program;
let aspectCanvas;
let mView;

const objects_template = ['Sphere','Cube','Pyramid','Cylinder','Torus'];
const ambientColor = vec4(0.2, 0.2, 0.2, 1.0);

let time = 1;
let lights = [];
let lightsFolders = [];
let fovyFolder;

const NUMBER_INITIAL_LIGHTS = 1;
const MAX_LIGHTS = 8;
const LIGHT_SCALE = 0.05;
const RANDOM_RANGE = 1.5;
const WHITE_COLOR = vec3(255,255,255);
/* Base Constants */
const OFFSET_Y = -0.55;
const SCALE_XZ = 3;
const SCALE_Y = 0.1;


/** View matrix */
let mProjection;

function setup(shaders) {
    let canvas = document.getElementById('gl-canvas');
    aspectCanvas = window.innerWidth / window.innerHeight;

    gl = setupWebGL(canvas);
    program = buildProgramFromSources(gl, shaders['shader.vert'], shaders['shader.frag']);

    let camera = {
        eye: vec3(-5.0,3.0,3.0),
        at: vec3(0,0,0),
        up: vec3(0,1,0),
        fovy: 35,
        aspect: aspectCanvas, 
        near: 0.1,
        far: 20
    }

    let options = {
        backFaceCulling: true,
        zBuffer: true,
        showLights: true,
        movLights: false
    }

    let materialBase = {
        Ka: [15,15,10],
        Kd: [60,40,15],
        Ks: [65,65,65],
        shininess: 150
    }

    let object = {
        Ka: [0,25,0],
        Kd: [0,100,0],
        Ks: [255,255,255],
        shininess: 50,
        objectsOption: 'Sphere'
    }


    class Light {
        constructor(pos, Ia, Id, Is, isDirectional, isActive) {
            this.pos = pos;
            this.Ia = Ia;
            this.Id = Id;
            this.Is = Is;
            this.isDirectional = isDirectional;
            this.isActive = isActive;
        }
    }

    class LightFolders {
        constructor(folderX, folderY, folderZ) {
            this.folderX = folderX;
            this.folderY = folderY;
            this.folderZ = folderZ;
        }
    }

    gl.useProgram(program);
    

    const guiRight = new DAT.GUI();
    
    const optionsGUI = guiRight.addFolder("options");
    optionsGUI.add(options, "backFaceCulling").name("backface culling").listen().onChange( function(v) {
        if(v) { gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); } else { gl.disable(gl.CULL_FACE); }
    });
    optionsGUI.add(options, "zBuffer").name("depth test").listen().onChange( function(v) {
        if(v) { gl.enable(gl.DEPTH_TEST); } else { gl.disable(gl.DEPTH_TEST); }
    });
    optionsGUI.add(options, "showLights").name("show lights").listen();
    optionsGUI.add(options, "movLights").name("move lights").listen();

    const cameraGUI = guiRight.addFolder("camera");
    fovyFolder = cameraGUI.add(camera, "fovy").min(1).max(100).step(1);
    cameraGUI.add(camera, "near").min(0.1).max(20);
    cameraGUI.add(camera, "far").min(0.1).max(20);

    const eye = cameraGUI.addFolder("eye");
    eye.add(camera.eye,0).step(0.05).name("x");
    eye.add(camera.eye,1).step(0.05).name("y");
    eye.add(camera.eye,2).step(0.05).name("z");
    
    const at = cameraGUI.addFolder("at");
    at.add(camera.at,0).step(0.05).name("x");
    at.add(camera.at,1).step(0.05).name("y");
    at.add(camera.at,2).step(0.05).name("z");
    
    const up = cameraGUI.addFolder("up");
    up.add(camera.up,0).min(-1).max(1).step(0.05).name("x");
    up.add(camera.up,1).min(-1).max(1).step(0.05).name("y");
    up.add(camera.up,2).min(-1).max(1).step(0.05).name("z");

    const lightsGUI = guiRight.addFolder("lights");
    function createLightFolder(l) {
        // Adding the light to the array of lights
        let light = new Light(vec3(randomNumber(-RANDOM_RANGE,RANDOM_RANGE), 1, randomNumber(-RANDOM_RANGE,RANDOM_RANGE)), WHITE_COLOR, WHITE_COLOR, WHITE_COLOR, false, true);
        lights.push(light);
        
        // Creating the folders
        const light1GUI = lightsGUI.addFolder("Light "+(l+1));
        const positionLights = light1GUI.addFolder("position");
        
        const folderX = positionLights.add(lights[l].pos, 0).name("x").step(0.01);
        const folderY = positionLights.add(lights[l].pos, 1).name("y").step(0.01);
        const folderZ = positionLights.add(lights[l].pos, 2).name("z").step(0.01);
        positionLights.addColor(lights[l], 'Ia').name("ambient");
        positionLights.addColor(lights[l], 'Id').name("diffuse");
        positionLights.addColor(lights[l], 'Is').name("specular");
        positionLights.add(lights[l], "isDirectional").name("directional");
        positionLights.add(lights[l], "isActive").name("active");

        // Save the folders for movement of the lights
        lightsFolders.push(new LightFolders(folderX, folderY, folderZ));
    }

    /*
     *  Add Lights in GUI function 
     */
    let lightObject = {
        addLightFun : function() {
            let l = lights.length;
            if(l == MAX_LIGHTS) {
                alert("Isn't that enough?");
                return;
            }
            createLightFolder(l);
            gl.uniform1i(gl.getUniformLocation(program, "uNLights"), lights.length);
        }
    }
    lightsGUI.add(lightObject, 'addLightFun').name("Add Light");

    /*
     *  Adding the lights and creating the folders for the initial lights
     */
    for(let l = 0; l < NUMBER_INITIAL_LIGHTS; l++) {
        createLightFolder(l);
    }
    gl.uniform1i(gl.getUniformLocation(program, "uNLights"), lights.length);

    

    /* Creating the Left GUI*/
    const guiLeft = new DAT.GUI();

    guiLeft.add(object,'objectsOption',objects_template).name("Object");
    const materialGUI = guiLeft.addFolder("material");
    materialGUI.addColor(object, 'Ka');
    materialGUI.addColor(object, 'Kd');
    materialGUI.addColor(object, 'Ks');
    materialGUI.add(object, "shininess");

    mProjection = perspective(camera.fovy, camera.aspect, camera.near, camera.far);
    resize_canvas();
    window.addEventListener("resize", resize_canvas);

    gl.clearColor(ambientColor[0], ambientColor[1], ambientColor[2], ambientColor[3]);
    gl.viewport(0, 0, canvas.width, canvas.height);

    mode = gl.TRIANGLES;

    CUBE.init(gl);
    SPHERE.init(gl);
    TORUS.init(gl);
    CYLINDER.init(gl);
    PYRAMID.init(gl);

    gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
    gl.enable(gl.DEPTH_TEST);   // Enables Z-buffer depth test

    function randomNumber(min, max) { 
        return Math.random() * (max - min) + min;
    } 

    function resize_canvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        gl.viewport(0, 0, canvas.width, canvas.height);
        camera.aspect = canvas.width/canvas.height;
        mProjection = perspective(camera.fovy, camera.aspect, canvas.width, canvas.height);
    }

    window.addEventListener('wheel', function(event) {
        const factor = 1 - event.deltaY/1000;
        fovyFolder.setValue(Math.max(1, Math.min(100, camera.fovy * factor))); 
    });


    function uploadModelView() {
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mModelView"), false, flatten(modelView()));
    }

    function drawCube() {
        uploadModelView();
        CUBE.draw(gl, program, mode);
    }

    function drawSphere() {
        uploadModelView();
        SPHERE.draw(gl, program, mode);
    }

    function drawTorus() {
        uploadModelView();
        TORUS.draw(gl, program, mode);
    }

    function drawPyramid() {
        uploadModelView();
        PYRAMID.draw(gl, program, mode);
    }

    function drawCylinder() {
        uploadModelView();
        CYLINDER.draw(gl, program, mode);
    }
 
    function drawFigure() {
        const uShininess = gl.getUniformLocation(program, "uMaterial.shininess");
        const uKa = gl.getUniformLocation(program, "uMaterial.Ka");
        const uKd = gl.getUniformLocation(program, "uMaterial.Kd");
        const uKs = gl.getUniformLocation(program, "uMaterial.Ks");

        gl.uniform1f(uShininess, object.shininess);
        gl.uniform3fv(uKa, object.Ka);
        gl.uniform3fv(uKd, object.Kd);
        gl.uniform3fv(uKs, object.Ks);

        switch(object.objectsOption) {
            case "Sphere":
                drawSphere();
                break;
            case "Cube":
                drawCube();
                break;
            case "Torus":
                drawTorus();
                break;
            case "Pyramid":
                drawPyramid();
                break;
            case "Cylinder":
                drawCylinder();
                break;
        }
    }

    function drawBase() {
        
        const uShininess = gl.getUniformLocation(program, "uMaterial.shininess");
        const uKa = gl.getUniformLocation(program, "uMaterial.Ka");
        const uKd = gl.getUniformLocation(program, "uMaterial.Kd");
        const uKs = gl.getUniformLocation(program, "uMaterial.Ks");

        gl.uniform1f(uShininess, materialBase.shininess);
        gl.uniform3fv(uKa,materialBase.Ka);
        gl.uniform3fv(uKd,materialBase.Kd);
        gl.uniform3fv(uKs,materialBase.Ks);

        multTranslation([0, OFFSET_Y, 0]);
        multScale([SCALE_XZ, SCALE_Y, SCALE_XZ]);
        drawCube();
    }

    function drawLight() {
        multScale([LIGHT_SCALE,LIGHT_SCALE,LIGHT_SCALE]);
        uploadModelView();
        SPHERE.draw(gl, program, mode);
    }

    function drawAllLights() {
        if(options.showLights) {
            const uIsLight = gl.getUniformLocation(program, "uIsLight");
            for(let l = 0; l < lights.length; l++) {
                pushMatrix();
                    gl.uniform1i(uIsLight, l);
                    const uPos = gl.getUniformLocation(program, "uLight["+l+"].pos");
                    const uIa = gl.getUniformLocation(program, "uLight["+l+"].Ia");
                    const uId = gl.getUniformLocation(program, "uLight["+l+"].Id");
                    const uIs = gl.getUniformLocation(program, "uLight["+l+"].Is");
                    const uIsDirectional = gl.getUniformLocation(program, "uLight["+l+"].isDirectional");
                    const uIsActive = gl.getUniformLocation(program, "uLight["+l+"].isActive");
                
                    if(options.movLights) {
                        let movPosition = l%2 == 0 ? mult(rotateX(time), vec4(lights[l].pos, 1.0)) : mult(rotateY(time), vec4(lights[l].pos, 1.0));
                        lightsFolders[l].folderX.setValue(movPosition[0]);
                        lightsFolders[l].folderY.setValue(movPosition[1]);
                        lightsFolders[l].folderZ.setValue(movPosition[2]);
                    }

                    gl.uniform3fv(uPos, lights[l].pos);
                    gl.uniform3fv(uIa, lights[l].Ia);
                    gl.uniform3fv(uId, lights[l].Id);
                    gl.uniform3fv(uIs, lights[l].Is);
                    gl.uniform1i(uIsDirectional, lights[l].isDirectional);
                    gl.uniform1i(uIsActive, lights[l].isActive);

                    multTranslation([lights[l].pos[0], lights[l].pos[1], lights[l].pos[2]]);
                    drawLight();
                popMatrix();
            }
            gl.uniform1i(uIsLight, -1);
        }
    }

    function render() {
        window.requestAnimationFrame(render);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.useProgram(program);

        mView = lookAt(camera.eye, camera.at, camera.up);
        STACK.loadMatrix(mView);

        mProjection = perspective(camera.fovy, camera.aspect, camera.near, camera.far);


        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mModelView"), false, flatten(STACK.modelView()));
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mProjection"), false, flatten(mProjection));
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mNormals"), false, flatten(normalMatrix(STACK.modelView())));
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mViewNormals"), false, flatten(normalMatrix(mView)));
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mView"), false, flatten(mView));
        
        pushMatrix();
            drawAllLights();
        popMatrix();
        pushMatrix();
            drawBase();
        popMatrix();
        drawFigure();
    }
    window.requestAnimationFrame(render);
}

{
    const shaderUrls = ['shader.vert', 'shader.frag'];
    loadShadersFromURLS(shaderUrls).then(s => setup(s));
}
