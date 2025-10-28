# Powerlevel10k configuration for Kubelens
# This is a simplified configuration that works well in web terminals

# Instant prompt mode
typeset -g POWERLEVEL9K_INSTANT_PROMPT=quiet

# Prompt elements
typeset -g POWERLEVEL9K_LEFT_PROMPT_ELEMENTS=(
  dir                     # current directory
  vcs                     # git status
  newline                 # \n
  prompt_char             # prompt symbol
)

typeset -g POWERLEVEL9K_RIGHT_PROMPT_ELEMENTS=(
  status                  # exit code of the last command
  command_execution_time  # duration of the last command
  background_jobs         # presence of background jobs
  time                    # current time
)

# Prompt character
typeset -g POWERLEVEL9K_PROMPT_CHAR_OK_{VIINS,VICMD,VIVIS,VIOWR}_FOREGROUND=76
typeset -g POWERLEVEL9K_PROMPT_CHAR_ERROR_{VIINS,VICMD,VIVIS,VIOWR}_FOREGROUND=196
typeset -g POWERLEVEL9K_PROMPT_CHAR_{OK,ERROR}_VIINS_CONTENT_EXPANSION='❯'
typeset -g POWERLEVEL9K_PROMPT_CHAR_{OK,ERROR}_VICMD_CONTENT_EXPANSION='❮'
typeset -g POWERLEVEL9K_PROMPT_CHAR_{OK,ERROR}_VIVIS_CONTENT_EXPANSION='V'
typeset -g POWERLEVEL9K_PROMPT_CHAR_{OK,ERROR}_VIOWR_CONTENT_EXPANSION='▶'
typeset -g POWERLEVEL9K_PROMPT_CHAR_OVERWRITE_STATE=true
typeset -g POWERLEVEL9K_PROMPT_CHAR_LEFT_PROMPT_LAST_SEGMENT_END_SYMBOL=''

# Directory
typeset -g POWERLEVEL9K_DIR_FOREGROUND=31
typeset -g POWERLEVEL9K_SHORTEN_STRATEGY=truncate_to_unique
typeset -g POWERLEVEL9K_SHORTEN_DELIMITER=
typeset -g POWERLEVEL9K_DIR_SHORTENED_FOREGROUND=103
typeset -g POWERLEVEL9K_DIR_ANCHOR_FOREGROUND=39
typeset -g POWERLEVEL9K_DIR_ANCHOR_BOLD=true

# Git status
typeset -g POWERLEVEL9K_VCS_CLEAN_FOREGROUND=76
typeset -g POWERLEVEL9K_VCS_UNTRACKED_FOREGROUND=76
typeset -g POWERLEVEL9K_VCS_MODIFIED_FOREGROUND=178

# Status
typeset -g POWERLEVEL9K_STATUS_EXTENDED_STATES=true
typeset -g POWERLEVEL9K_STATUS_OK=false
typeset -g POWERLEVEL9K_STATUS_OK_FOREGROUND=70
typeset -g POWERLEVEL9K_STATUS_OK_VISUAL_IDENTIFIER_EXPANSION='✔'
typeset -g POWERLEVEL9K_STATUS_ERROR_FOREGROUND=160
typeset -g POWERLEVEL9K_STATUS_ERROR_VISUAL_IDENTIFIER_EXPANSION='✘'

# Command execution time
typeset -g POWERLEVEL9K_COMMAND_EXECUTION_TIME_THRESHOLD=3
typeset -g POWERLEVEL9K_COMMAND_EXECUTION_TIME_PRECISION=0
typeset -g POWERLEVEL9K_COMMAND_EXECUTION_TIME_FOREGROUND=101

# Background jobs
typeset -g POWERLEVEL9K_BACKGROUND_JOBS_FOREGROUND=70

# Time
typeset -g POWERLEVEL9K_TIME_FOREGROUND=66
typeset -g POWERLEVEL9K_TIME_FORMAT='%D{%H:%M:%S}'

# Transient prompt
typeset -g POWERLEVEL9K_TRANSIENT_PROMPT=always

# Instant prompt mode
typeset -g POWERLEVEL9K_INSTANT_PROMPT=quiet

# Disable configuration wizard
typeset -g POWERLEVEL9K_DISABLE_CONFIGURATION_WIZARD=true

