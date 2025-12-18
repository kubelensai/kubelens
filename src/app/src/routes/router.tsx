import { createBrowserRouter, createHashRouter } from "react-router-dom";
import { Capacitor } from '@capacitor/core';

import App from "../App";
import ProtectedRoute from "../components/auth/ProtectedRoute";
import PermissionRoute from "../components/auth/PermissionRoute";
import RequireEnabledCluster from "../components/shared/RequireEnabledCluster";
import LoadingScreen from "../pages/LoadingScreen";
import ClusterManagement from "../pages/ClusterManagement";
import ClusterRoleBindings from "../pages/ClusterRoleBindings";
import ClusterRoleBindingDetails from "../pages/ClusterRoleBindingDetails";
import ClusterRoles from "../pages/ClusterRoles";
import ClusterRoleDetails from "../pages/ClusterRoleDetails";
import ConfigMaps from "../pages/ConfigMaps";
import ConfigMapDetails from "../pages/ConfigMapDetails";
import CronJobs from "../pages/CronJobs";
import CronJobDetails from "../pages/CronJobDetails";
import CustomResourceDefinitions from "../pages/CustomResourceDefinitions/CustomResourceDefinitions";
import CRDDetails from "../pages/CustomResourceDefinitions/CRDDetails";
import GenericCRDPage from "../pages/CustomResources/GenericCRDPage";
import GenericCRDDetails from "../pages/CustomResources/GenericCRDDetails";
import DaemonSets from "../pages/DaemonSets";
import DaemonSetDetails from "../pages/DaemonSetDetails";
import Dashboard from "../pages/Dashboard";
import Deployments from "../pages/Deployments";
import DeploymentDetails from "../pages/DeploymentDetails";
import Endpoints from "../pages/Endpoints";
import EndpointDetails from "../pages/EndpointDetails";
import Events from "../pages/Events";
import ExtensionsPage from "../extensions/Extensions";
import ExtensionDetailPage from "../extensions/ExtensionDetail";
import HPAs from "../pages/HPAs";
import HPADetails from "../pages/HPADetails";
import Ingresses from "../pages/Ingresses";
import IngressDetails from "../pages/IngressDetails";
import IngressClasses from "../pages/IngressClasses";
import IngressClassDetails from "../pages/IngressClassDetails";
import Jobs from "../pages/Jobs";
import JobDetails from "../pages/JobDetails";
import Leases from "../pages/Leases";
import LeaseDetails from "../pages/LeaseDetails";
import Login from "../pages/Login";
import MutatingWebhookConfigurations from "../pages/MutatingWebhookConfigurations";
import MutatingWebhookConfigurationDetails from "../pages/MutatingWebhookConfigurationDetails";
import Namespaces from "../pages/Namespaces";
import Profile from "../pages/Profile";
import NetworkPolicies from "../pages/NetworkPolicies";
import NetworkPolicyDetails from "../pages/NetworkPolicyDetails";
import Nodes from "../pages/Nodes";
import NodeDetails from "../pages/NodeDetails";
import PDBs from "../pages/PDBs";
import PDBDetails from "../pages/PDBDetails";
import PersistentVolumeClaims from "../pages/PersistentVolumeClaims";
import PersistentVolumes from "../pages/PersistentVolumes";
import Pods from "../pages/Pods";
import PodDetails from "../pages/PodDetails";
import PriorityClasses from "../pages/PriorityClasses";
import PriorityClassDetails from "../pages/PriorityClassDetails";
import ReplicaSets from "../pages/ReplicaSets";
import ReplicaSetDetails from "../pages/ReplicaSetDetails";
import RoleBindings from "../pages/RoleBindings";
import RoleBindingDetails from "../pages/RoleBindingDetails";
import Roles from "../pages/Roles";
import RoleDetails from "../pages/RoleDetails";
import RuntimeClasses from "../pages/RuntimeClasses";
import RuntimeClassDetails from "../pages/RuntimeClassDetails";
import Secrets from "../pages/Secrets";
import SecretDetails from "../pages/SecretDetails";
import ServiceAccounts from "../pages/ServiceAccounts";
import ServiceAccountDetails from "../pages/ServiceAccountDetails";
import Services from "../pages/Services";
import ServiceDetails from "../pages/ServiceDetails";
// Signup disabled
// import Signup from "../pages/Signup";
import StatefulSets from "../pages/StatefulSets";
import StatefulSetDetails from "../pages/StatefulSetDetails";
import StorageClasses from "../pages/StorageClasses";
import StorageClassDetails from "../pages/StorageClassDetails";
import PersistentVolumeDetails from "../pages/PersistentVolumeDetails";
import PersistentVolumeClaimDetails from "../pages/PersistentVolumeClaimDetails";
import Users from "../pages/Users";
import Groups from "../pages/Groups";
import Logging from "../pages/Logging";
import AuditSettings from "../pages/AuditSettings";
import ValidatingWebhookConfigurations from "../pages/ValidatingWebhookConfigurations";
import ValidatingWebhookConfigurationDetails from "../pages/ValidatingWebhookConfigurationDetails";
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
  // 🎯 Loading screen - Entry point for all navigation
  {
    path: "/",
    element: <LoadingScreen />,
  },

  // 🔓 Public routes (no authentication required)
  {
    path: "/login",
    element: <Login />,
  },
  // Signup disabled
  // {
  //   path: "/signup",
  //   element: <Signup />,
  // },

  // 🔒 Protected routes (authentication required)
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <App />,
        children: [
          // Common routes (all authenticated users)
          {
            path: "/dashboard",
            element: <Dashboard />,
          },
          {
            path: "/profile",
            element: <Profile />,
          },
          
          // Permission-protected admin routes
          // Cluster management - requires "clusters" permission with manage action
          {
            element: <PermissionRoute resource="clusters" action="manage" />,
            children: [
              { path: "/clusters", element: <ClusterManagement /> },
            ],
          },
          
          // Extension management - requires "extensions" permission
          {
            element: <PermissionRoute resource="extensions" action="read" />,
            children: [
              { path: "/extensions", element: <ExtensionsPage /> },
              { path: "/extensions/:name", element: <ExtensionDetailPage /> },
            ],
          },
          
          // User management - requires "users" permission
          {
            element: <PermissionRoute resource="users" action="read" />,
            children: [
              { path: "/users", element: <Users /> },
            ],
          },
          
          // Group management - requires "groups" permission
          {
            element: <PermissionRoute resource="groups" action="read" />,
            children: [
              { path: "/groups", element: <Groups /> },
            ],
          },
          
          // Logging - requires "logging" permission
          {
            element: <PermissionRoute resource="logging" action="read" />,
            children: [
              { path: "/logging", element: <Logging /> },
            ],
          },
          
          // Audit settings - requires "audit" permission
          {
            element: <PermissionRoute resource="audit" action="read" />,
            children: [
              { path: "/audit-settings", element: <AuditSettings /> },
            ],
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
      // StatefulSet Details routes
      {
        path: "clusters/:cluster/namespaces/:namespace/statefulsets/:statefulsetName",
        element: withClusterCheck(<StatefulSetDetails />),
      },
      // ReplicaSet Details routes
      {
        path: "clusters/:cluster/namespaces/:namespace/replicasets/:replicasetName",
        element: withClusterCheck(<ReplicaSetDetails />),
      },
      // Job Details routes
      {
        path: "clusters/:cluster/namespaces/:namespace/jobs/:jobName",
        element: withClusterCheck(<JobDetails />),
      },
      // CronJob Details routes
      {
        path: "clusters/:cluster/namespaces/:namespace/cronjobs/:cronjobName",
        element: withClusterCheck(<CronJobDetails />),
      },
      // HPA Details routes
      {
        path: "clusters/:cluster/namespaces/:namespace/hpas/:hpaName",
        element: withClusterCheck(<HPADetails />),
      },
      // PDB Details routes
      {
        path: "clusters/:cluster/namespaces/:namespace/pdbs/:pdbName",
        element: withClusterCheck(<PDBDetails />),
      },
      // Priority Class Details routes
      {
        path: "clusters/:cluster/priorityclasses/:priorityClassName",
        element: withClusterCheck(<PriorityClassDetails />),
      },
      // Runtime Class Details routes
      {
        path: "clusters/:cluster/runtimeclasses/:runtimeClassName",
        element: withClusterCheck(<RuntimeClassDetails />),
      },
      // Lease Details routes
      {
        path: "clusters/:cluster/namespaces/:namespace/leases/:leaseName",
        element: withClusterCheck(<LeaseDetails />),
      },
      // Mutating Webhook Configuration Details routes
      {
        path: "clusters/:cluster/mutatingwebhookconfigurations/:webhookName",
        element: withClusterCheck(<MutatingWebhookConfigurationDetails />),
      },
      // Validating Webhook Configuration Details routes
      {
        path: "clusters/:cluster/validatingwebhookconfigurations/:webhookName",
        element: withClusterCheck(<ValidatingWebhookConfigurationDetails />),
      },
      // CRD Details routes
      {
        path: "clusters/:cluster/customresourcedefinitions/:crdName",
        element: withClusterCheck(<CRDDetails />),
      },
      // Service Details routes
      {
        path: "clusters/:cluster/namespaces/:namespace/services/:serviceName",
        element: withClusterCheck(<ServiceDetails />),
      },
      // ServiceAccount Details routes
      {
        path: "clusters/:cluster/namespaces/:namespace/serviceaccounts/:serviceAccountName",
        element: withClusterCheck(<ServiceAccountDetails />),
      },
      // Role Details routes
      {
        path: "clusters/:cluster/namespaces/:namespace/roles/:roleName",
        element: withClusterCheck(<RoleDetails />),
      },
      // RoleBinding Details routes
      {
        path: "clusters/:cluster/namespaces/:namespace/rolebindings/:roleBindingName",
        element: withClusterCheck(<RoleBindingDetails />),
      },
      // ClusterRole Details routes
      {
        path: "clusters/:cluster/clusterroles/:clusterRoleName",
        element: withClusterCheck(<ClusterRoleDetails />),
      },
      // ClusterRoleBinding Details routes
      {
        path: "clusters/:cluster/clusterrolebindings/:clusterRoleBindingName",
        element: withClusterCheck(<ClusterRoleBindingDetails />),
      },
      // Endpoint Details routes
      {
        path: "clusters/:cluster/namespaces/:namespace/endpoints/:endpointName",
        element: withClusterCheck(<EndpointDetails />),
      },
      // Ingress Details routes
      {
        path: "clusters/:cluster/namespaces/:namespace/ingresses/:ingressName",
        element: withClusterCheck(<IngressDetails />),
      },
      // Ingress Class Details routes
      {
        path: "clusters/:cluster/ingressclasses/:ingressClassName",
        element: withClusterCheck(<IngressClassDetails />),
      },
      // Network Policy Details routes
      {
        path: "clusters/:cluster/namespaces/:namespace/networkpolicies/:networkPolicyName",
        element: withClusterCheck(<NetworkPolicyDetails />),
      },
      // ConfigMap Details routes
      {
        path: "clusters/:cluster/namespaces/:namespace/configmaps/:configMapName",
        element: withClusterCheck(<ConfigMapDetails />),
      },
      // Secret Details routes
      {
        path: "clusters/:cluster/namespaces/:namespace/secrets/:secretName",
        element: withClusterCheck(<SecretDetails />),
      },
      // Storage Class Details routes
      {
        path: "clusters/:cluster/storageclasses/:storageClassName",
        element: withClusterCheck(<StorageClassDetails />),
      },
      // Persistent Volume Details routes
      {
        path: "clusters/:cluster/persistentvolumes/:pvName",
        element: withClusterCheck(<PersistentVolumeDetails />),
      },
      // Persistent Volume Claim Details routes
      {
        path: "clusters/:cluster/namespaces/:namespace/persistentvolumeclaims/:pvcName",
        element: withClusterCheck(<PersistentVolumeClaimDetails />),
      },
      // Custom Resources routes
      {
        path: "customresources/:group/:version/:resource",
        element: withClusterCheck(<GenericCRDPage />),
      },
      {
        path: "clusters/:cluster/customresources/:group/:version/:resource/:resourceName",
        element: withClusterCheck(<GenericCRDDetails />),
      },
      {
        path: "clusters/:cluster/customresources/:group/:version/:resource",
        element: withClusterCheck(<GenericCRDPage />),
      },
      {
        path: "clusters/:cluster/namespaces/:namespace/customresources/:group/:version/:resource/:resourceName",
        element: withClusterCheck(<GenericCRDDetails />),
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
    ],
  },
];

// Use HashRouter for mobile (Capacitor) and BrowserRouter for web
// HashRouter uses # in URLs which works with file:// protocol
// BrowserRouter uses HTML5 history which only works on web servers
const isNativePlatform = Capacitor.isNativePlatform();
const routerFactory = isNativePlatform ? createHashRouter : createBrowserRouter;

console.log('[Router] Platform:', isNativePlatform ? 'Native (Mobile)' : 'Web', '- Using:', isNativePlatform ? 'HashRouter' : 'BrowserRouter');

const router = routerFactory(routes, {
  future: {
    v7_fetcherPersist: true,
    v7_normalizeFormMethod: true,
    v7_partialHydration: true,
    v7_relativeSplatPath: true,
    v7_skipActionErrorRevalidation: true,
  },
});

export default router;
