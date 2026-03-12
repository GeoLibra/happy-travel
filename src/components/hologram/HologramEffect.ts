import * as THREE from 'three';

export const HologramShaderUniforms = {
    uHologramProgress: { value: 0 }, // 0: full hologram, 1: full solid
    uTime: { value: 0 },
    uMinZ: { value: 0 },
    uMaxZ: { value: 0 },
    uGroupMatrixInverse: { value: new THREE.Matrix4() },
    uDirection: { value: 1.0 } // 1.0 or -1.0 depending on orientation
};

export function applyHologramMaterial(f1CarGroup: THREE.Group) {
    // 1. Calculate Bounding box for Hologram scan
    const origPos = f1CarGroup.position.clone();
    const origRot = f1CarGroup.rotation.clone();
    const origScale = f1CarGroup.scale.clone();
    
    f1CarGroup.position.set(0,0,0);
    f1CarGroup.rotation.set(0,0,0);
    f1CarGroup.scale.set(1,1,1);
    f1CarGroup.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(f1CarGroup);
    HologramShaderUniforms.uMinZ.value = box.min.z;
    HologramShaderUniforms.uMaxZ.value = box.max.z;
    
    f1CarGroup.position.copy(origPos);
    f1CarGroup.rotation.copy(origRot);
    f1CarGroup.scale.copy(origScale);

    // 2. Traverse and replace materials
    f1CarGroup.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            const origMat = mesh.material as THREE.MeshStandardMaterial;
            if (origMat) {
                // Store the original material so we can revert back to it later
                if (!mesh.userData.originalMaterial) {
                    mesh.userData.originalMaterial = origMat;
                }
                
                const mat = origMat.clone();
                mesh.material = mat;
                mat.transparent = true;
                mat.metalness = 0.8;
                mat.roughness = 0.2;
                mat.envMapIntensity = 1.0;
                
                mat.onBeforeCompile = (shader) => {
                    shader.uniforms.uHologramProgress = HologramShaderUniforms.uHologramProgress;
                    shader.uniforms.uTime = HologramShaderUniforms.uTime;
                    shader.uniforms.uMinZ = HologramShaderUniforms.uMinZ;
                    shader.uniforms.uMaxZ = HologramShaderUniforms.uMaxZ;
                    shader.uniforms.uGroupMatrixInverse = HologramShaderUniforms.uGroupMatrixInverse;
                    shader.uniforms.uDirection = HologramShaderUniforms.uDirection;
                    
                    shader.vertexShader = `
                        varying vec3 vWorldPos;
                        ${shader.vertexShader}
                    `;
                    shader.vertexShader = shader.vertexShader.replace(
                        '#include <worldpos_vertex>',
                        `
                        #include <worldpos_vertex>
                        vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
                        `
                    );
                    
                    shader.fragmentShader = `
                        uniform float uHologramProgress;
                        uniform float uTime;
                        uniform float uMinZ;
                        uniform float uMaxZ;
                        uniform float uDirection;
                        uniform mat4 uGroupMatrixInverse;
                        varying vec3 vWorldPos;
                        ${shader.fragmentShader}
                    `;
                    
                    shader.fragmentShader = shader.fragmentShader.replace(
                        '#include <dithering_fragment>',
                        `
                        #include <dithering_fragment>
                        
                        vec4 groupLocalPos = uGroupMatrixInverse * vec4(vWorldPos, 1.0);
                        float localZ = groupLocalPos.z;
                        
                        float nz = (localZ - uMinZ) / (uMaxZ - uMinZ);
                        if (uDirection < 0.0) {
                            nz = 1.0 - nz;
                        }
                        
                        // We want the scan to start from the front (uDirection = 1, so front is nz=1)
                        // and move to the back. So targetZ goes from 1 to 0 as uHologramProgress goes 0 to 1
                        float targetZ = 1.2 - (uHologramProgress * 1.4); 
                        float diff = nz - targetZ;
                        
                        vec3 holoColor = vec3(0.0, 0.6, 1.0); 
                        
                        vec3 gridPos = groupLocalPos.xyz * 3.0; // FIXED: dimension mismatch!
                        float gridX = smoothstep(0.46, 0.5, abs(fract(gridPos.x) - 0.5));
                        float gridY = smoothstep(0.46, 0.5, abs(fract(gridPos.y) - 0.5));
                        float gridZ = smoothstep(0.46, 0.5, abs(fract(gridPos.z) - 0.5));
                        float gridAlpha = max(max(gridX, gridY), gridZ);
                        
                        float scanline = sin(localZ * 10.0 - uTime * 5.0) * 0.5 + 0.5;
                        scanline = pow(scanline, 4.0);
                        
                        vec3 finalHolo = holoColor * 0.1 + holoColor * gridAlpha * 0.9 + holoColor * scanline * 0.5;
                        
                        float glowLine = smoothstep(0.05, 0.0, abs(diff));
                        vec3 edgeGlow = vec3(0.0, 1.0, 0.8) * glowLine * 3.0;
                        
                        // nz > targetZ means this part is still a hologram
                        if (nz > targetZ) {
                            gl_FragColor = vec4(finalHolo + edgeGlow, max(0.15, gridAlpha * 0.8 + scanline * 0.5 + glowLine));
                        } else {
                            // Solid part of the car
                            float glowFill = smoothstep(0.0, -0.1, diff); 
                            gl_FragColor = vec4(gl_FragColor.rgb + edgeGlow * (1.0 - glowFill), 1.0);
                        }
                        `
                    );
                };
            }
        }
    });

    return true; // isCarMaterialReplaced
}

export function revertHologramMaterial(f1CarGroup: THREE.Group) {
    let reverted = false;
    f1CarGroup.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            if (mesh.userData.originalMaterial) {
                // Dispose of the cloned hologram material
                if (Array.isArray(mesh.material)) {
                     mesh.material.forEach(m => m.dispose());
                } else if (mesh.material) {
                     mesh.material.dispose();
                }
                // Restore original
                mesh.material = mesh.userData.originalMaterial;
                reverted = true;
            }
        }
    });
    return reverted;
}
