import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";
import * as kubernetes from "@pulumi/kubernetes";

const project = new gcp.organizations.Project("project", {
    projectId: "devopscon-munich-2024",
    orgId: process.env.MOROSYSTEMS_ORG_ID,
    billingAccount: process.env.MOROSYSTEMS_BILLING_ACCOUNT,
});

const kubernetesService = new gcp.projects.Service("kubernetes", {
    project: project.projectId,
    service: "container.googleapis.com",
});

const gkeCluster = new gcp.container.Cluster(
    "cluster",
    {
        project: project.projectId,
        name: "devopscon-munich-2024",
        location: "europe-west1-b",
        initialNodeCount: 1,
    },
    { dependsOn: [kubernetesService] },
);

const kubeConfig = pulumi.interpolate`apiVersion: v1
clusters:
- cluster:
    certificate-authority-data: ${gkeCluster.masterAuth.clusterCaCertificate}
    server: https://${gkeCluster.endpoint}
  name: ${gkeCluster.name}
contexts:
- context:
    cluster: ${gkeCluster.name}
    user: ${gkeCluster.name}
  name: ${gkeCluster.name}
current-context: ${gkeCluster.name}
kind: Config
preferences: {}
users:
- name: ${gkeCluster.name}
  user:
    exec:
      apiVersion: client.authentication.k8s.io/v1beta1
      command: gke-gcloud-auth-plugin
      installHint: Install gke-gcloud-auth-plugin for use with kubectl by following
        https://cloud.google.com/blog/products/containers-kubernetes/kubectl-auth-changes-in-gke
      provideClusterInfo: true
`;

const kubernetesProvider = new kubernetes.Provider("kubernetes-provider", { kubeconfig: kubeConfig });

const labels = { app: "hello-world-rest" };
const deployment = new kubernetes.apps.v1.Deployment("hello-world-rest", {
    metadata: {
        namespace: "default",
        labels: labels,
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

const service = new kubernetes.core.v1.Service("hello-world-rest", {
    metadata: {
        namespace: "default",
    },
    spec: {
        selector: labels,
        ports: [{ port: 80, targetPort: deployment.spec.template.spec.containers[0].ports[0].containerPort }],
        type: "NodePort",
    },
}, { provider: kubernetesProvider });

const publicIp = new gcp.compute.GlobalAddress("public-ip", {
    project: project.projectId,
});

const ingress = new kubernetes.networking.v1.Ingress("hello-world-rest", {
    metadata: {
        namespace: "default",
        annotations: {
            "kubernetes.io/ingress.global-static-ip-name": publicIp.name,
        },
    },
    spec: {
        defaultBackend: {
            service: {
                name: service.metadata.name,
                port: {
                    number: service.spec.ports[0].port,
                },
            },
        }
    },
}, { provider: kubernetesProvider });

export const ipAddress = publicIp.address;
