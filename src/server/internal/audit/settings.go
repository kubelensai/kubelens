package audit

// DefaultSettings returns default audit settings (Full Logging preset)
func DefaultSettings() *Settings {
	return &Settings{
		Enabled:               true,
		CollectAuthentication: true,
		CollectSecurity:       true,
		CollectAudit:          true,
		CollectSystem:         true,
		CollectInfo:           true,
		CollectWarn:           true,
		CollectError:          true,
		CollectCritical:       true,
		SamplingEnabled:       false,
		SamplingRate:          1.0,
	}
}
