package modules

import (
	"context"
	"fmt"
	"sync"

	log "github.com/sirupsen/logrus"
)

// Registry manages all registered modules
type Registry struct {
	modules map[string]Module
	mu      sync.RWMutex
}

// NewRegistry creates a new module registry
func NewRegistry() *Registry {
	return &Registry{
		modules: make(map[string]Module),
	}
}

// Register registers a module
func (r *Registry) Register(module Module) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	name := module.Name()
	if _, exists := r.modules[name]; exists {
		return fmt.Errorf("module %s already registered", name)
	}

	r.modules[name] = module
	log.Infof("✅ Registered module: %s v%s (%s)", module.Name(), module.Version(), module.Type())
	return nil
}

// Unregister removes a module from the registry
func (r *Registry) Unregister(name string) {
	r.mu.Lock()
	defer r.mu.Unlock()

	delete(r.modules, name)
	log.Infof("Unregistered module: %s", name)
}

// Get retrieves a module by name
func (r *Registry) Get(name string) (Module, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	module, ok := r.modules[name]
	return module, ok
}

// List returns all registered modules
func (r *Registry) List() []Module {
	r.mu.RLock()
	defer r.mu.RUnlock()

	modules := make([]Module, 0, len(r.modules))
	for _, m := range r.modules {
		modules = append(modules, m)
	}
	return modules
}

// ListByType returns modules filtered by type
func (r *Registry) ListByType(moduleType ModuleType) []Module {
	r.mu.RLock()
	defer r.mu.RUnlock()

	modules := make([]Module, 0)
	for _, m := range r.modules {
		if m.Type() == moduleType {
			modules = append(modules, m)
		}
	}
	return modules
}

// Count returns the number of registered modules
func (r *Registry) Count() int {
	r.mu.RLock()
	defer r.mu.RUnlock()

	return len(r.modules)
}

// InitializeAll initializes all registered modules
func (r *Registry) InitializeAll(ctx context.Context, deps *ModuleDependencies) error {
	r.mu.RLock()
	modules := make([]Module, 0, len(r.modules))
	for _, m := range r.modules {
		modules = append(modules, m)
	}
	r.mu.RUnlock()

	log.Infof("Initializing %d module(s)...", len(modules))

	for _, module := range modules {
		log.Infof("Initializing module: %s", module.Name())
		if err := module.Initialize(ctx, deps); err != nil {
			return fmt.Errorf("failed to initialize module %s: %w", module.Name(), err)
		}
	}

	log.Info("✅ All modules initialized successfully")
	return nil
}

// ShutdownAll shuts down all modules gracefully
func (r *Registry) ShutdownAll(ctx context.Context) error {
	r.mu.RLock()
	modules := make([]Module, 0, len(r.modules))
	for _, m := range r.modules {
		modules = append(modules, m)
	}
	r.mu.RUnlock()

	log.Info("Shutting down modules...")

	for _, module := range modules {
		log.Infof("Shutting down module: %s", module.Name())
		if err := module.Shutdown(ctx); err != nil {
			log.Errorf("Failed to shutdown module %s: %v", module.Name(), err)
			// Continue shutting down other modules
		}
	}

	log.Info("All modules shut down")
	return nil
}

// GetUIMetadataAll returns UI metadata for all registered modules
func (r *Registry) GetUIMetadataAll() []UIMetadata {
	r.mu.RLock()
	defer r.mu.RUnlock()

	metadata := make([]UIMetadata, 0, len(r.modules))
	for _, m := range r.modules {
		metadata = append(metadata, *m.GetUIMetadata())
	}
	return metadata
}

// DefaultRegistry is the global default registry
var DefaultRegistry = NewRegistry()

