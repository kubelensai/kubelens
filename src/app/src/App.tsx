import { Routes, Route } from 'react-router-dom'
import Layout from './components/shared/Layout'
import RequireEnabledCluster from './components/shared/RequireEnabledCluster'
import Dashboard from './pages/Dashboard'
import ClusterManagement from './pages/ClusterManagement'
import ClusterOverview from './pages/ClusterOverview'
import Pods from './pages/Pods'
import Deployments from './pages/Deployments'
import DaemonSets from './pages/DaemonSets'
import StatefulSets from './pages/StatefulSets'
import ReplicaSets from './pages/ReplicaSets'
import Jobs from './pages/Jobs'
import CronJobs from './pages/CronJobs'
import Services from './pages/Services'
import Endpoints from './pages/Endpoints'
import Ingresses from './pages/Ingresses'
import IngressClasses from './pages/IngressClasses'
import NetworkPolicies from './pages/NetworkPolicies'
import Namespaces from './pages/Namespaces'
import StorageClasses from './pages/StorageClasses'
import PersistentVolumes from './pages/PersistentVolumes'
import PersistentVolumeClaims from './pages/PersistentVolumeClaims'
import ConfigMaps from './pages/ConfigMaps'
import ServiceAccounts from './pages/ServiceAccounts'
import ClusterRoles from './pages/ClusterRoles'
import Roles from './pages/Roles'
import ClusterRoleBindings from './pages/ClusterRoleBindings'
import RoleBindings from './pages/RoleBindings'
import Secrets from './pages/Secrets'
import HPAs from './pages/HPAs'
import PDBs from './pages/PDBs'
import PriorityClasses from './pages/PriorityClasses'
import RuntimeClasses from './pages/RuntimeClasses'
import Leases from './pages/Leases'
import MutatingWebhookConfigurations from './pages/MutatingWebhookConfigurations'
import ValidatingWebhookConfigurations from './pages/ValidatingWebhookConfigurations'
import CustomResourceDefinitions from './pages/CustomResourceDefinitions/CustomResourceDefinitions'
import GenericCRDPage from './pages/CustomResources/GenericCRDPage'
import Nodes from './pages/Nodes'
import Events from './pages/Events'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="clusters" element={<ClusterManagement />} />
        <Route path="clusters/:cluster/overview" element={<RequireEnabledCluster><ClusterOverview /></RequireEnabledCluster>} />
        {/* Namespace-specific resource routes */}
        <Route path="clusters/:cluster/namespaces/:namespace/pods" element={<RequireEnabledCluster><Pods /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/namespaces/:namespace/deployments" element={<RequireEnabledCluster><Deployments /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/namespaces/:namespace/daemonsets" element={<RequireEnabledCluster><DaemonSets /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/namespaces/:namespace/statefulsets" element={<RequireEnabledCluster><StatefulSets /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/namespaces/:namespace/replicasets" element={<RequireEnabledCluster><ReplicaSets /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/namespaces/:namespace/jobs" element={<RequireEnabledCluster><Jobs /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/namespaces/:namespace/cronjobs" element={<RequireEnabledCluster><CronJobs /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/namespaces/:namespace/services" element={<RequireEnabledCluster><Services /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/namespaces/:namespace/endpoints" element={<RequireEnabledCluster><Endpoints /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/namespaces/:namespace/ingresses" element={<RequireEnabledCluster><Ingresses /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/namespaces/:namespace/networkpolicies" element={<RequireEnabledCluster><NetworkPolicies /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/namespaces/:namespace/persistentvolumeclaims" element={<RequireEnabledCluster><PersistentVolumeClaims /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/namespaces/:namespace/configmaps" element={<RequireEnabledCluster><ConfigMaps /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/namespaces/:namespace/secrets" element={<RequireEnabledCluster><Secrets /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/namespaces/:namespace/serviceaccounts" element={<RequireEnabledCluster><ServiceAccounts /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/namespaces/:namespace/hpas" element={<RequireEnabledCluster><HPAs /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/namespaces/:namespace/pdbs" element={<RequireEnabledCluster><PDBs /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/namespaces/:namespace/leases" element={<RequireEnabledCluster><Leases /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/namespaces/:namespace/events" element={<RequireEnabledCluster><Events /></RequireEnabledCluster>} />
        {/* Cluster-specific resource routes (all namespaces) */}
        <Route path="clusters/:cluster/pods" element={<RequireEnabledCluster><Pods /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/deployments" element={<RequireEnabledCluster><Deployments /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/daemonsets" element={<RequireEnabledCluster><DaemonSets /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/statefulsets" element={<RequireEnabledCluster><StatefulSets /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/replicasets" element={<RequireEnabledCluster><ReplicaSets /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/jobs" element={<RequireEnabledCluster><Jobs /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/cronjobs" element={<RequireEnabledCluster><CronJobs /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/services" element={<RequireEnabledCluster><Services /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/endpoints" element={<RequireEnabledCluster><Endpoints /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/ingresses" element={<RequireEnabledCluster><Ingresses /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/ingressclasses" element={<RequireEnabledCluster><IngressClasses /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/networkpolicies" element={<RequireEnabledCluster><NetworkPolicies /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/namespaces" element={<RequireEnabledCluster><Namespaces /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/storageclasses" element={<RequireEnabledCluster><StorageClasses /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/persistentvolumes" element={<RequireEnabledCluster><PersistentVolumes /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/persistentvolumeclaims" element={<RequireEnabledCluster><PersistentVolumeClaims /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/configmaps" element={<RequireEnabledCluster><ConfigMaps /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/secrets" element={<RequireEnabledCluster><Secrets /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/serviceaccounts" element={<RequireEnabledCluster><ServiceAccounts /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/clusterroles" element={<RequireEnabledCluster><ClusterRoles /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/namespaces/:namespace/roles" element={<RequireEnabledCluster><Roles /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/roles" element={<RequireEnabledCluster><Roles /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/clusterrolebindings" element={<RequireEnabledCluster><ClusterRoleBindings /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/namespaces/:namespace/rolebindings" element={<RequireEnabledCluster><RoleBindings /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/rolebindings" element={<RequireEnabledCluster><RoleBindings /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/hpas" element={<RequireEnabledCluster><HPAs /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/pdbs" element={<RequireEnabledCluster><PDBs /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/leases" element={<RequireEnabledCluster><Leases /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/priorityclasses" element={<RequireEnabledCluster><PriorityClasses /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/runtimeclasses" element={<RequireEnabledCluster><RuntimeClasses /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/mutatingwebhookconfigurations" element={<RequireEnabledCluster><MutatingWebhookConfigurations /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/validatingwebhookconfigurations" element={<RequireEnabledCluster><ValidatingWebhookConfigurations /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/customresourcedefinitions" element={<RequireEnabledCluster><CustomResourceDefinitions /></RequireEnabledCluster>} />
        {/* Dynamic Custom Resources */}
        <Route path="clusters/:cluster/customresources/:group/:version/:resource" element={<RequireEnabledCluster><GenericCRDPage /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/namespaces/:namespace/customresources/:group/:version/:resource" element={<RequireEnabledCluster><GenericCRDPage /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/nodes" element={<RequireEnabledCluster><Nodes /></RequireEnabledCluster>} />
        <Route path="clusters/:cluster/events" element={<RequireEnabledCluster><Events /></RequireEnabledCluster>} />
        {/* Legacy routes (all clusters, all namespaces) */}
        <Route path="pods" element={<RequireEnabledCluster><Pods /></RequireEnabledCluster>} />
        <Route path="deployments" element={<RequireEnabledCluster><Deployments /></RequireEnabledCluster>} />
        <Route path="daemonsets" element={<RequireEnabledCluster><DaemonSets /></RequireEnabledCluster>} />
        <Route path="statefulsets" element={<RequireEnabledCluster><StatefulSets /></RequireEnabledCluster>} />
        <Route path="replicasets" element={<RequireEnabledCluster><ReplicaSets /></RequireEnabledCluster>} />
        <Route path="jobs" element={<RequireEnabledCluster><Jobs /></RequireEnabledCluster>} />
        <Route path="cronjobs" element={<RequireEnabledCluster><CronJobs /></RequireEnabledCluster>} />
        <Route path="services" element={<RequireEnabledCluster><Services /></RequireEnabledCluster>} />
        <Route path="endpoints" element={<RequireEnabledCluster><Endpoints /></RequireEnabledCluster>} />
        <Route path="ingresses" element={<RequireEnabledCluster><Ingresses /></RequireEnabledCluster>} />
        <Route path="ingressclasses" element={<RequireEnabledCluster><IngressClasses /></RequireEnabledCluster>} />
        <Route path="networkpolicies" element={<RequireEnabledCluster><NetworkPolicies /></RequireEnabledCluster>} />
        <Route path="namespaces" element={<RequireEnabledCluster><Namespaces /></RequireEnabledCluster>} />
        <Route path="storageclasses" element={<RequireEnabledCluster><StorageClasses /></RequireEnabledCluster>} />
        <Route path="persistentvolumes" element={<RequireEnabledCluster><PersistentVolumes /></RequireEnabledCluster>} />
        <Route path="persistentvolumeclaims" element={<RequireEnabledCluster><PersistentVolumeClaims /></RequireEnabledCluster>} />
        <Route path="configmaps" element={<RequireEnabledCluster><ConfigMaps /></RequireEnabledCluster>} />
        <Route path="secrets" element={<RequireEnabledCluster><Secrets /></RequireEnabledCluster>} />
        <Route path="serviceaccounts" element={<RequireEnabledCluster><ServiceAccounts /></RequireEnabledCluster>} />
        <Route path="clusterroles" element={<RequireEnabledCluster><ClusterRoles /></RequireEnabledCluster>} />
        <Route path="roles" element={<RequireEnabledCluster><Roles /></RequireEnabledCluster>} />
        <Route path="clusterrolebindings" element={<RequireEnabledCluster><ClusterRoleBindings /></RequireEnabledCluster>} />
        <Route path="rolebindings" element={<RequireEnabledCluster><RoleBindings /></RequireEnabledCluster>} />
        <Route path="hpas" element={<RequireEnabledCluster><HPAs /></RequireEnabledCluster>} />
        <Route path="pdbs" element={<RequireEnabledCluster><PDBs /></RequireEnabledCluster>} />
        <Route path="leases" element={<RequireEnabledCluster><Leases /></RequireEnabledCluster>} />
        <Route path="priorityclasses" element={<RequireEnabledCluster><PriorityClasses /></RequireEnabledCluster>} />
        <Route path="runtimeclasses" element={<RequireEnabledCluster><RuntimeClasses /></RequireEnabledCluster>} />
        <Route path="mutatingwebhookconfigurations" element={<RequireEnabledCluster><MutatingWebhookConfigurations /></RequireEnabledCluster>} />
        <Route path="validatingwebhookconfigurations" element={<RequireEnabledCluster><ValidatingWebhookConfigurations /></RequireEnabledCluster>} />
        <Route path="customresourcedefinitions" element={<RequireEnabledCluster><CustomResourceDefinitions /></RequireEnabledCluster>} />
        {/* Dynamic Custom Resources (legacy routes) */}
        <Route path="customresources/:group/:version/:resource" element={<RequireEnabledCluster><GenericCRDPage /></RequireEnabledCluster>} />
        <Route path="nodes" element={<RequireEnabledCluster><Nodes /></RequireEnabledCluster>} />
        <Route path="events" element={<RequireEnabledCluster><Events /></RequireEnabledCluster>} />
      </Route>
    </Routes>
  )
}

export default App

