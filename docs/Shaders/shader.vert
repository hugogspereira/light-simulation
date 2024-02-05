uniform mat4 mModelView;
uniform mat4 mProjection;
uniform mat4 mNormals;

attribute vec4 vPosition;
attribute vec3 vNormal;

varying vec3 fP;
varying vec3 fNormal;

void main() {
    gl_Position = mProjection * mModelView * vPosition;

    fP = (mModelView * vPosition).xyz;
    fNormal = (mNormals * vec4(vNormal, 1.0)).xyz;
}