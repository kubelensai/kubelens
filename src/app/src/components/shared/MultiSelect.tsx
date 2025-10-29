import { Fragment, useState } from 'react'
import { Listbox, Transition } from '@headlessui/react'
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/24/outline'

interface MultiSelectProps {
  options: string[]
  selected: string[]
  onChange: (selected: string[]) => void
  placeholder?: string
  label?: string
}

export default function MultiSelect({ options, selected, onChange, placeholder, label }: MultiSelectProps) {
  const [searchTerm, setSearchTerm] = useState('')

  const filteredOptions = options.filter((option) =>
    option.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleToggle = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter((item) => item !== option))
    } else {
      onChange([...selected, option])
    }
  }

  const handleSelectAll = () => {
    onChange(options)
  }

  const handleClearAll = () => {
    onChange([])
  }

  return (
    <Listbox value={selected} onChange={() => {}} multiple>
      <div className="relative">
        {label && (
          <Listbox.Label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            {label}
          </Listbox.Label>
        )}
        <Listbox.Button className="relative w-full cursor-pointer rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 py-2 pl-3 pr-10 text-left text-sm shadow-sm hover:border-gray-400 dark:hover:border-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors">
          <span className="block truncate">
            {selected.length === 0 ? (
              <span className="text-gray-400 dark:text-gray-500">{placeholder || 'Select options...'}</span>
            ) : (
              <span className="text-gray-900 dark:text-gray-100">
                {selected.length} selected
                {selected.length <= 2 && (
                  <span className="text-gray-500 dark:text-gray-400 ml-1">
                    ({selected.join(', ')})
                  </span>
                )}
              </span>
            )}
          </span>
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
            <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
          </span>
        </Listbox.Button>
        <Transition
          as={Fragment}
          leave="transition ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <Listbox.Options className="absolute z-50 mt-1 max-h-72 w-full overflow-hidden rounded-lg bg-white dark:bg-gray-800 shadow-xl ring-1 ring-black ring-opacity-5 focus:outline-none">
            {/* Search and Actions Bar */}
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-10">
              <div className="p-2">
                <input
                  type="text"
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div className="flex items-center justify-between px-2 pb-2 text-xs">
                <span className="text-gray-500 dark:text-gray-400">
                  {selected.length} of {options.length}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleSelectAll()
                    }}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                  >
                    All
                  </button>
                  <span className="text-gray-300 dark:text-gray-600">|</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleClearAll()
                    }}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                  >
                    None
                  </button>
                </div>
              </div>
            </div>

            {/* Options List */}
            <div className="overflow-y-auto max-h-56">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  No options found
                </div>
              ) : (
                filteredOptions.map((option) => (
                  <Listbox.Option
                    key={option}
                    value={option}
                    onClick={() => handleToggle(option)}
                    className={({ active }) =>
                      `relative cursor-pointer select-none py-2 pl-10 pr-4 transition-colors ${
                        active 
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100' 
                          : 'text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`
                    }
                  >
                    <>
                      <span className={`block truncate text-sm ${selected.includes(option) ? 'font-semibold' : 'font-normal'}`}>
                        {option}
                      </span>
                      {selected.includes(option) && (
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600 dark:text-blue-400">
                          <CheckIcon className="h-4 w-4" aria-hidden="true" />
                        </span>
                      )}
                    </>
                  </Listbox.Option>
                ))
              )}
            </div>
          </Listbox.Options>
        </Transition>
      </div>
    </Listbox>
  )
}

