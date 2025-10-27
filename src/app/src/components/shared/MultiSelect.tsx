import { Fragment, useState } from 'react'
import { Listbox, Transition } from '@headlessui/react'
import { CheckIcon, ChevronUpDownIcon, XMarkIcon } from '@heroicons/react/24/outline'

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

  const handleRemove = (option: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(selected.filter((item) => item !== option))
  }

  return (
    <Listbox value={selected} onChange={onChange} multiple>
      <div className="relative">
        {label && (
          <Listbox.Label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
            {label}
          </Listbox.Label>
        )}
        <Listbox.Button className="relative w-full cursor-pointer rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 py-2 pl-3 pr-10 text-left text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
          <span className="flex flex-wrap gap-1">
            {selected.length === 0 ? (
              <span className="text-gray-400">{placeholder || 'Select options...'}</span>
            ) : (
              selected.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-1 rounded bg-blue-100 dark:bg-blue-900 px-2 py-0.5 text-xs text-blue-800 dark:text-blue-200"
                >
                  {item}
                  <button
                    onClick={(e) => handleRemove(item, e)}
                    className="hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    <XMarkIcon className="h-3 w-3" />
                  </button>
                </span>
              ))
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
          <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white dark:bg-gray-700 py-1 text-sm shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
            <div className="sticky top-0 bg-white dark:bg-gray-700 p-2 border-b border-gray-200 dark:border-gray-600">
              <input
                type="text"
                className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-gray-500 dark:text-gray-400">No options found</div>
            ) : (
              filteredOptions.map((option) => (
                <Listbox.Option
                  key={option}
                  value={option}
                  onClick={() => handleToggle(option)}
                  className={({ active }) =>
                    `relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                      active ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100' : 'text-gray-900 dark:text-gray-100'
                    }`
                  }
                >
                  {({ selected: isSelected }) => (
                    <>
                      <span className={`block truncate ${isSelected ? 'font-medium' : 'font-normal'}`}>
                        {option}
                      </span>
                      {selected.includes(option) && (
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600 dark:text-blue-400">
                          <CheckIcon className="h-5 w-5" aria-hidden="true" />
                        </span>
                      )}
                    </>
                  )}
                </Listbox.Option>
              ))
            )}
          </Listbox.Options>
        </Transition>
      </div>
    </Listbox>
  )
}

