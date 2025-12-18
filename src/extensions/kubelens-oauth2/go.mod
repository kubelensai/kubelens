module github.com/sonnguyen/kubelens-oauth2

go 1.24.0

require (
	github.com/go-jose/go-jose/v4 v4.1.1
	github.com/hashicorp/go-plugin v1.6.0
	github.com/sonnguyen/kubelens v0.0.0
	gopkg.in/yaml.v3 v3.0.1
)

require (
	github.com/fatih/color v1.14.1 // indirect
	github.com/golang/protobuf v1.5.4 // indirect
	github.com/hashicorp/go-hclog v1.5.0 // indirect
	github.com/hashicorp/yamux v0.1.1 // indirect
	github.com/mattn/go-colorable v0.1.13 // indirect
	github.com/mattn/go-isatty v0.0.20 // indirect
	github.com/mitchellh/go-testing-interface v0.0.0-20171004221916-a61a99592b77 // indirect
	github.com/oklog/run v1.0.0 // indirect
	golang.org/x/crypto v0.43.0 // indirect
	golang.org/x/net v0.45.0 // indirect
	golang.org/x/sys v0.37.0 // indirect
	golang.org/x/text v0.30.0 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20251002232023-7c0ddcbb5797 // indirect
	google.golang.org/grpc v1.75.1 // indirect
	google.golang.org/protobuf v1.36.10 // indirect
)

replace (
	github.com/sonnguyen/kubelens => ../../server
	google.golang.org/genproto => google.golang.org/genproto v0.0.0-20251002232023-7c0ddcbb5797
)
