import Image from 'next/image'
import React from 'react'

const Gezi = () => {
  return (
    <div>
                <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
                  <h2 className="text-2xl font-bold text-indigo-900 mb-4">Gezilerimiz</h2>
                  <input 
                    type="file" 
                    multiple 
                    onChange={() => {}}
                    className="mb-4"
                  />
                  <textarea
                    placeholder="Gezi açıklaması ekle..."
                    className="w-full p-4 border rounded-lg mb-4"
                  />
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Örnek Fotoğraf Gösterimi */}
                    <div className="relative h-40 bg-gray-200 rounded-lg overflow-hidden">
                      <Image
                        src="/gezi-placeholder.jpg"
                        alt="Gezi Fotoğrafı"
                        layout="fill"
                        objectFit="cover"
                      />
                    </div>
                  </div>
                </div>
    </div>
  )
}

export default Gezi
