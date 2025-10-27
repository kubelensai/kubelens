package db

// PermissionOptions represents the available options for permissions
type PermissionOptions struct {
	Resources  []string `json:"resources"`
	Actions    []string `json:"actions"`
	Clusters   []string `json:"clusters"`
	Namespaces []string `json:"namespaces"`
}

// GetPermissionOptions returns all available permission options
func (db *DB) GetPermissionOptions() (*PermissionOptions, error) {
	// Get all enabled clusters
	clusters, err := db.ListEnabledClusters()
	if err != nil {
		return nil, err
	}

	clusterNames := []string{"*"} // Always include wildcard
	for _, cluster := range clusters {
		clusterNames = append(clusterNames, cluster.Name)
	}

	// Define available resources (Kubernetes resource types)
	resources := []string{
		"*",
		"clusters",
		"namespaces",
		"nodes",
		"pods",
		"deployments",
		"services",
		"configmaps",
		"secrets",
		"ingresses",
		"persistentvolumes",
		"persistentvolumeclaims",
		"statefulsets",
		"daemonsets",
		"replicasets",
		"jobs",
		"cronjobs",
		"events",
		"serviceaccounts",
		"roles",
		"rolebindings",
		"clusterroles",
		"clusterrolebindings",
		"networkpolicies",
		"storageclasses",
		"runtimeclasses",
		"leases",
		"mutatingwebhookconfigurations",
		"validatingwebhookconfigurations",
	}

	// Define available actions (CRUD operations)
	actions := []string{
		"*",
		"read",
		"create",
		"update",
		"delete",
	}

	// Define available namespaces (we'll get these dynamically from clusters)
	namespaces := []string{"*", "default", "kube-system", "kube-public", "kube-node-lease"}

	return &PermissionOptions{
		Resources:  resources,
		Actions:    actions,
		Clusters:   clusterNames,
		Namespaces: namespaces,
	}, nil
}

