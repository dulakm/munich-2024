import * as kubernetes from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

export const infrastructureProjectStack = new pulumi.StackReference(`organization/munich-2024/dev`);
export const kubernetesProvider = new kubernetes.Provider("kubernetes-provider", { kubeconfig: infrastructureProjectStack.getOutput("kubeConfig") });

const labels = { app: "another-hello-world-rest" };
const deployment = new kubernetes.apps.v1.Deployment("another-hello-world-rest", {
    metadata: {
        namespace: "default",
    },
    spec: {
        replicas: 1,
        selector: { matchLabels: labels },
        template: {
            metadata: { labels: labels },
            spec: {
                containers: [{
                    name: "hello-world-rest",
                    image: "vad1mo/hello-world-rest:latest",
                    ports: [{ containerPort: 5050 }],
                }],
            },
        },
    },
}, { provider: kubernetesProvider });
