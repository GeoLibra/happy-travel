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
    f1CarGroup.updateMatrixWorld(true);

    // 2. Traverse and replace materials
    f1CarGroup.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;

            // Handle both single materials and material arrays
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

            const newMaterials = materials.map((origMat, index) => {
                if (!origMat) return origMat;

                // Unique key for each material slot
                const userDataKey = Array.isArray(mesh.material) ? `originalMaterial_${index}` : 'originalMaterial';

                if (!mesh.userData[userDataKey]) {
                    mesh.userData[userDataKey] = origMat;
                }

                const mat = (origMat as THREE.MeshStandardMaterial).clone();
                mat.transparent = true;
                mat.depthWrite = true; // Still use depthWrite for the solid parts
                mat.metalness = Math.max(0.7, (origMat as any).metalness || 0);
                mat.roughness = Math.min(0.3, (origMat as any).roughness || 1);

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

                        // Single sweep zone
                        float targetZ = 1.5 - (uHologramProgress * 2.0);
                        float diff = nz - targetZ;

                        vec3 holoColor = vec3(0.0, 0.6, 1.0);

                        vec3 gridPos = groupLocalPos.xyz * 3.0;
                        float gridX = smoothstep(0.46, 0.5, abs(fract(gridPos.x) - 0.5));
                        float gridY = smoothstep(0.46, 0.5, abs(fract(gridPos.y) - 0.5));
                        float gridZ = smoothstep(0.46, 0.5, abs(fract(gridPos.z) - 0.5));
                        float gridAlpha = max(max(gridX, gridY), gridZ);

                        float scanline = sin(localZ * 10.0 - uTime * 5.0) * 0.5 + 0.5;
                        scanline = pow(scanline, 4.0);

                        vec3 finalHolo = holoColor * 0.2 + holoColor * gridAlpha * 0.8 + holoColor * scanline * 0.5;

                        // Leading edge glow
                        float glowLine = smoothstep(0.1, 0.0, abs(diff)) * 3.0;
                        vec3 edgeGlow = vec3(0.0, 1.0, 0.8) * glowLine;

                        // Smooth transition zone: 0.5 units wide
                        float transitionWidth = 0.5;

                        if (diff > 0.0) {
                            // Behind the scan line - full hologram
                            float holoAlpha = max(0.3, gridAlpha * 0.8 + scanline * 0.5 + glowLine * 0.3);
                            gl_FragColor = vec4(finalHolo + edgeGlow, holoAlpha);
                        }
                        else if (diff > -transitionWidth) {
                            // Transition zone - blend from hologram to solid
                            float blendFactor = smoothstep(-transitionWidth, 0.0, diff);

                            float holoAlpha = max(0.3, gridAlpha * 0.8 + scanline * 0.5 + glowLine * 0.3);
                            vec3 holoWithGlow = finalHolo + edgeGlow;

                            // Gradually reduce hologram effect and increase opacity
                            vec3 blendedColor = mix(gl_FragColor.rgb, holoWithGlow, blendFactor * 0.4);
                            float blendedAlpha = mix(1.0, holoAlpha, blendFactor);

                            gl_FragColor = vec4(blendedColor + vec3(0.0, 0.5, 0.8) * blendFactor * 0.3, blendedAlpha);
                        }
                        else {
                            // Fully solid area
                            gl_FragColor = vec4(gl_FragColor.rgb, 1.0);
                        }
                        `
                    );
                    return mat;
                };
                return mat;
            });

            mesh.material = Array.isArray(mesh.material) ? newMaterials : newMaterials[0];
        }
    });

    return true; // isCarMaterialReplaced
}

export function revertHologramMaterial(f1CarGroup: THREE.Group) {
    let reverted = false;
    f1CarGroup.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

            const originalArr: THREE.Material[] = [];
            let hasOriginals = false;

            materials.forEach((mat, index) => {
                const userDataKey = Array.isArray(mesh.material) ? `originalMaterial_${index}` : 'originalMaterial';
                if (mesh.userData[userDataKey]) {
                    if (mat.dispose) mat.dispose();
                    originalArr.push(mesh.userData[userDataKey]);
                    hasOriginals = true;
                } else {
                    originalArr.push(mat);
                }
            });

            if (hasOriginals) {
                mesh.material = Array.isArray(mesh.material) ? originalArr : originalArr[0];
                reverted = true;
            }
        }
    });
    return reverted;
}
