import { createBrowserRouter } from "react-router-dom";

import App from "../App";
import RequireEnabledCluster from "../components/shared/RequireEnabledCluster";
import ClusterManagement from "../pages/ClusterManagement";
import ClusterRoleBindings from "../pages/ClusterRoleBindings";
import ClusterRoles from "../pages/ClusterRoles";
import ConfigMaps from "../pages/ConfigMaps";
import CronJobs from "../pages/CronJobs";
import CustomResourceDefinitions from "../pages/CustomResourceDefinitions/CustomResourceDefinitions";
import GenericCRDPage from "../pages/CustomResources/GenericCRDPage";
import DaemonSets from "../pages/DaemonSets";
import DaemonSetDetails from "../pages/DaemonSetDetails";
import Dashboard from "../pages/Dashboard";
import Deployments from "../pages/Deployments";
import DeploymentDetails from "../pages/DeploymentDetails";
import Endpoints from "../pages/Endpoints";
import Events from "../pages/Events";
import HPAs from "../pages/HPAs";
import IngressClasses from "../pages/IngressClasses";
import Ingresses from "../pages/Ingresses";
import Integrations from "../pages/Integrations";
import Jobs from "../pages/Jobs";
import Leases from "../pages/Leases";
import Login from "../pages/Login";
import MutatingWebhookConfigurations from "../pages/MutatingWebhookConfigurations";
import Namespaces from "../pages/Namespaces";
import Profile from "../pages/Profile";
import NetworkPolicies from "../pages/NetworkPolicies";
import Nodes from "../pages/Nodes";
import NodeDetails from "../pages/NodeDetails";
import PDBs from "../pages/PDBs";
import PersistentVolumeClaims from "../pages/PersistentVolumeClaims";
import PersistentVolumes from "../pages/PersistentVolumes";
import Pods from "../pages/Pods";
import PodDetails from "../pages/PodDetails";
import PriorityClasses from "../pages/PriorityClasses";
import ReplicaSets from "../pages/ReplicaSets";
import RoleBindings from "../pages/RoleBindings";
import Roles from "../pages/Roles";
import RuntimeClasses from "../pages/RuntimeClasses";
import Secrets from "../pages/Secrets";
import ServiceAccounts from "../pages/ServiceAccounts";
import Services from "../pages/Services";
import Signup from "../pages/Signup";
import StatefulSets from "../pages/StatefulSets";
import StorageClasses from "../pages/StorageClasses";
import Users from "../pages/Users";
import Groups from "../pages/Groups";
import ValidatingWebhookConfigurations from "../pages/ValidatingWebhookConfigurations";
import NotFound from "../pages/NotFound";

// Define common resource paths
const resourceTypes = {
  workloads: [
    { path: "pods", element: <Pods /> },
    { path: "deployments", element: <Deployments /> },
    { path: "daemonsets", element: <DaemonSets /> },
    { path: "statefulsets", element: <StatefulSets /> },
    { path: "replicasets", element: <ReplicaSets /> },
    { path: "jobs", element: <Jobs /> },
    { path: "cronjobs", element: <CronJobs /> },
  ],
  networking: [
    { path: "services", element: <Services /> },
    { path: "endpoints", element: <Endpoints /> },
    { path: "ingresses", element: <Ingresses /> },
    { path: "ingressclasses", element: <IngressClasses /> },
    { path: "networkpolicies", element: <NetworkPolicies /> },
  ],
  storage: [
    { path: "persistentvolumes", element: <PersistentVolumes /> },
    { path: "persistentvolumeclaims", element: <PersistentVolumeClaims /> },
    { path: "storageclasses", element: <StorageClasses /> },
  ],
  config: [
    { path: "configmaps", element: <ConfigMaps /> },
    { path: "secrets", element: <Secrets /> },
  ],
  rbac: [
    { path: "serviceaccounts", element: <ServiceAccounts /> },
    { path: "roles", element: <Roles /> },
    { path: "rolebindings", element: <RoleBindings /> },
    { path: "clusterroles", element: <ClusterRoles /> },
    { path: "clusterrolebindings", element: <ClusterRoleBindings /> },
  ],
  cluster: [
    { path: "nodes", element: <Nodes /> },
    { path: "namespaces", element: <Namespaces /> },
    { path: "events", element: <Events /> },
  ],
  other: [
    { path: "hpas", element: <HPAs /> },
    { path: "pdbs", element: <PDBs /> },
    { path: "leases", element: <Leases /> },
    { path: "priorityclasses", element: <PriorityClasses /> },
    { path: "runtimeclasses", element: <RuntimeClasses /> },
    { path: "customresourcedefinitions", element: <CustomResourceDefinitions /> },
    { path: "mutatingwebhookconfigurations", element: <MutatingWebhookConfigurations /> },
    { path: "validatingwebhookconfigurations", element: <ValidatingWebhookConfigurations /> },
  ],
};

// Helper function to wrap component with RequireEnabledCluster
const withClusterCheck = (component: JSX.Element) => (
  <RequireEnabledCluster>{component}</RequireEnabledCluster>
);

// Generate routes for different path patterns
const generateResourceRoutes = (resources: any[]) => {
  const routes: any[] = [];
  resources.forEach(({ path, element }) => {
    // Legacy route (all clusters, all namespaces)
    routes.push({
      path: path,
      element: withClusterCheck(element),
    });
    // Cluster-specific route
    routes.push({
      path: `clusters/:cluster/${path}`,
      element: withClusterCheck(element),
    });
    // Namespace-specific route
    routes.push({
      path: `clusters/:cluster/namespaces/:namespace/${path}`,
      element: withClusterCheck(element),
    });
  });
  return routes;
};

const routes = [
  // Auth routes (no layout)
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/signup",
    element: <Signup />,
  },
  // Main app routes (with layout)
  {
    path: "/",
    element: <App />,
    children: [
      {
        index: true,
        element: <Dashboard />,
      },
      {
        path: "dashboard",
        element: <Dashboard />,
      },
      {
        path: "clusters",
        element: <ClusterManagement />,
      },
      {
        path: "integrations",
        element: <Integrations />,
      },
      {
        path: "users",
        element: <Users />,
      },
      {
        path: "groups",
        element: <Groups />,
      },
      {
        path: "profile",
        element: <Profile />,
      },
      // Generate routes for all resource types
      ...Object.values(resourceTypes).flatMap(generateResourceRoutes),
      // Node Details routes
      {
        path: "clusters/:cluster/nodes/:nodeName",
        element: withClusterCheck(<NodeDetails />),
      },
      // Pod Details routes
      {
        path: "clusters/:cluster/namespaces/:namespace/pods/:podName",
        element: withClusterCheck(<PodDetails />),
      },
      // Deployment Details routes
      {
        path: "clusters/:cluster/namespaces/:namespace/deployments/:deploymentName",
        element: withClusterCheck(<DeploymentDetails />),
      },
      // DaemonSet Details routes
      {
        path: "clusters/:cluster/namespaces/:namespace/daemonsets/:daemonsetName",
        element: withClusterCheck(<DaemonSetDetails />),
      },
      // Custom Resources routes
      {
        path: "customresources/:group/:version/:resource",
        element: withClusterCheck(<GenericCRDPage />),
      },
      {
        path: "clusters/:cluster/customresources/:group/:version/:resource",
        element: withClusterCheck(<GenericCRDPage />),
      },
      {
        path: "clusters/:cluster/namespaces/:namespace/customresources/:group/:version/:resource",
        element: withClusterCheck(<GenericCRDPage />),
      },
      // 404 catch-all route (must be last)
      {
        path: "*",
        element: <NotFound />,
      },
    ],
  },
];

const router = createBrowserRouter(routes, {
  future: {
    v7_fetcherPersist: true,
    v7_normalizeFormMethod: true,
    v7_partialHydration: true,
    v7_relativeSplatPath: true,
    v7_skipActionErrorRevalidation: true,
  },
});

export default router;
