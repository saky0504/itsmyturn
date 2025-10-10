import React from 'react'

interface ChartData {
  label: string
  value: number
  color?: string
}

interface ChartProps {
  data: ChartData[]
  type?: 'bar' | 'line' | 'pie'
  width?: number
  height?: number
  className?: string
}

const Chart: React.FC<ChartProps> = ({
  data,
  type = 'bar',
  width = 400,
  height = 300,
  className = ''
}) => {
  const maxValue = Math.max(...data.map(item => item.value))

  if (type === 'bar') {
    return (
      <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
        <div className="flex items-end justify-between h-64 space-x-2">
          {data.map((item, index) => (
            <div key={index} className="flex flex-col items-center flex-1">
              <div
                className="w-full bg-green-500 rounded-t transition-all duration-300"
                style={{
                  height: `${(item.value / maxValue) * 200}px`,
                  backgroundColor: item.color || '#10b981'
                }}
              />
              <div className="text-xs text-gray-400 mt-2 text-center">
                {item.label}
              </div>
              <div className="text-xs text-gray-300 font-medium">
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (type === 'line') {
    const points = data.map((item, index) => {
      const x = (index / (data.length - 1)) * (width - 40) + 20
      const y = height - 40 - ((item.value / maxValue) * (height - 80))
      return `${x},${y}`
    }).join(' ')

    return (
      <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
        <svg width={width} height={height} className="w-full">
          <polyline
            fill="none"
            stroke="#10b981"
            strokeWidth="2"
            points={points}
          />
          {data.map((item, index) => {
            const x = (index / (data.length - 1)) * (width - 40) + 20
            const y = height - 40 - ((item.value / maxValue) * (height - 80))
            return (
              <circle
                key={index}
                cx={x}
                cy={y}
                r="4"
                fill="#10b981"
              />
            )
          })}
        </svg>
      </div>
    )
  }

  if (type === 'pie') {
    let cumulativePercentage = 0
    const radius = Math.min(width, height) / 2 - 20

    return (
      <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
        <svg width={width} height={height} className="w-full">
          {data.map((item, index) => {
            const percentage = item.value / data.reduce((sum, d) => sum + d.value, 0)
            const startAngle = cumulativePercentage * 360
            const endAngle = (cumulativePercentage + percentage) * 360
            cumulativePercentage += percentage

            const x1 = width / 2 + radius * Math.cos((startAngle - 90) * Math.PI / 180)
            const y1 = height / 2 + radius * Math.sin((startAngle - 90) * Math.PI / 180)
            const x2 = width / 2 + radius * Math.cos((endAngle - 90) * Math.PI / 180)
            const y2 = height / 2 + radius * Math.sin((endAngle - 90) * Math.PI / 180)

            const largeArcFlag = percentage > 0.5 ? 1 : 0

            const pathData = [
              `M ${width / 2} ${height / 2}`,
              `L ${x1} ${y1}`,
              `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
              'Z'
            ].join(' ')

            return (
              <path
                key={index}
                d={pathData}
                fill={item.color || `hsl(${index * 60}, 70%, 50%)`}
              />
            )
          })}
        </svg>
      </div>
    )
  }

  return null
}

export default Chart
