precision highp float;

uniform mat4 mView;
uniform mat4 mViewNormals;

varying vec3 fP;
varying vec3 fNormal;

const int MAX_LIGHTS = 8;

struct LightInfo {
    vec3 pos;
    vec3 Ia;
    vec3 Id;
    vec3 Is;
    bool isDirectional;
    bool isActive;
};

struct MaterialInfo {
    vec3 Ka;   
    vec3 Kd;
    vec3 Ks;
    float shininess;
};

uniform int uNLights;
uniform int uIsLight;

uniform LightInfo uLight[MAX_LIGHTS]; 
uniform MaterialInfo uMaterial; 

LightInfo getLight(int index) {
    for (int i=0; i<MAX_LIGHTS; i++) {
        if (i == uNLights) { break; }
        if (i == index) { return uLight[i]; }
    }
}

vec3 computeLight(int index){
    LightInfo light = getLight(index);

    vec3 N = normalize(fNormal.xyz);
    vec3 V = normalize(-fP);
    vec3 L;
    if(light.isDirectional) {
        L = normalize((mViewNormals * vec4(light.pos, 0.0)).xyz);
    }
    else {
        L = normalize((mView * vec4(light.pos, 1.0)).xyz - fP);
    }

    vec3 R = reflect(-L,N);

    vec3 ambientColor =  ((light.Ia/255.0)*(uMaterial.Ka/255.0));
    vec3 diffuseColor =  ((light.Id/255.0)*(uMaterial.Kd/255.0));
    vec3 specularColor = ((light.Is/255.0)*(uMaterial.Ks/255.0));

    float diffuseFactor = max( dot(L,N), 0.0 );
    vec3 diffuse = diffuseFactor * diffuseColor;
    float specularFactor = pow(max(dot(V,R), 0.0), uMaterial.shininess);
    vec3 specular = specularFactor * specularColor;

    if( dot(L,N) < 0.0 ) {
        specular = vec3(0.0, 0.0, 0.0);
    }

    if(light.isActive) {
        return ambientColor + diffuse + specular;
    }
    return vec3(0,0,0);
}

void main() {
    vec3 color = vec3(0,0,0);
    for (int i = 0; i < MAX_LIGHTS; i++)  {
        if(i == uNLights) { break; }
        if(i == uIsLight) { color = uLight[i].Id/255.0; break; }

        if(uLight[i].isActive && uIsLight < 0) {
            color += computeLight(i);
        }
    }
    gl_FragColor  = vec4(color, 1.0);        
}

