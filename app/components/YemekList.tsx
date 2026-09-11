import React from 'react'

const YemekList = () => {
  return (
    <div>
            <div className="py-12 bg-white">
        <div className="container mx-auto px-4 md:px-6">
          <div className="rounded-3xl bg-gradient-to-r from-sunny to-tangerine p-6 text-white shadow-lg shadow-tangerine/20 md:p-8">
            <h2 className="mb-4 font-display text-2xl">Yemek Listeleri</h2>
            <div className="flex items-center gap-4">
              <select className="rounded-xl bg-white px-4 py-2 text-ink">
                <option>Ocak 2024</option>
                <option>Şubat 2024</option>
              </select>
              <button className="flex items-center gap-2 rounded-full bg-white px-6 py-2 font-semibold text-tangerine-deep">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                PDF İndir
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default YemekList
